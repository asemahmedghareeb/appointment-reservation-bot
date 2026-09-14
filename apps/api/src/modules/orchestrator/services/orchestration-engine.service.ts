import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BookingCaseStatus,
  BookingMode,
  type BookingCase,
} from '@visaflow/database';
import {
  type ProviderContext,
  type SlotCandidate,
  type ProviderApplicantInput,
  type RouteInspectionResult,
} from '@visaflow/provider-core';
import { decrypt } from '@visaflow/crypto';
import type { OrchestrationExecutionOutcome, ProviderCode } from '@visaflow/shared-types';
import {
  OrchestratorRepository,
  type OrchestratorBookingCase,
} from '../repositories/orchestrator.repository.js';
import { CaseTransitionService } from './case-transition.service.js';
import { CaseLockService } from '../infrastructure/locks/case-lock.service.js';
import { ProviderAdapterResolver } from './provider-adapter-resolver.service.js';
import { IdempotencyGuardService } from './idempotency-guard.service.js';
import { BookingCaseNotFoundError } from '../../booking-cases/errors/booking-case-not-found.error.js';

@Injectable()
export class OrchestrationEngineService {
  constructor(
    private readonly repo: OrchestratorRepository,
    private readonly transitionService: CaseTransitionService,
    private readonly lockService: CaseLockService,
    private readonly adapterResolver: ProviderAdapterResolver,
    private readonly idempotencyGuard: IdempotencyGuardService,
  ) {}

  private buildContext(bookingCase: OrchestratorBookingCase, correlationId?: string): ProviderContext {
    const route = bookingCase.providerRoute;
    return {
      caseId: bookingCase.id,
      correlationId: correlationId ?? `corr_${randomUUID()}`,
      providerRoute: {
        id: route.id,
        providerCode: route.provider.code as unknown as ProviderCode,
        sourceCountry: route.sourceCountry,
        destinationCountry: route.destinationCountry,
        applicationCentre: route.applicationCentre,
        visaCategory: route.visaCategory,
        visaSubcategory: route.visaSubcategory,
        bookingMode: route.bookingMode as unknown as any,
        configuration: (route.configurationJson as Record<string, unknown>) || {},
      },
      casePreferences: {
        allowGroupSplit: bookingCase.allowGroupSplit,
        ...(bookingCase.preferredDateFrom ? { preferredDateFrom: bookingCase.preferredDateFrom.toISOString().slice(0, 10) } : {}),
        ...(bookingCase.preferredDateTo ? { preferredDateTo: bookingCase.preferredDateTo.toISOString().slice(0, 10) } : {}),
        ...(bookingCase.preferredTime ? { preferredTime: bookingCase.preferredTime } : {}),
      },
      applicantCount: bookingCase.bookingApplicants.length,
    };
  }

  private buildApplicantInputs(bookingCase: OrchestratorBookingCase): ProviderApplicantInput[] {
    return bookingCase.bookingApplicants.map((ba) => {
      const app = ba.applicant;
      let plaintextPassport: string;
      try {
        plaintextPassport = decrypt(app.passportNumberEncrypted);
      } catch {
        plaintextPassport = 'UNKNOWN';
      }

      return {
        id: app.id,
        position: ba.position,
        relation: ba.relation as any,
        isPrimary: ba.isPrimary,
        firstName: app.firstName,
        lastName: app.lastName,
        gender: app.gender as any,
        dateOfBirth: app.dateOfBirth.toISOString().slice(0, 10),
        nationality: app.nationality,
        passportNumber: plaintextPassport,
        passportExpiry: app.passportExpiry.toISOString().slice(0, 10),
        phone: app.phone,
        email: app.email,
      };
    });
  }

  async executeAuthentication(
    caseId: string,
    correlationId?: string,
  ): Promise<{ outcome: OrchestrationExecutionOutcome; caseState: BookingCase }> {
    return this.lockService.withCaseLock(
      { caseId, ownerId: 'orch_engine', sessionId: 'auth' },
      async () => {
        const bookingCase = await this.repo.findCaseById(caseId);
        if (!bookingCase) throw new BookingCaseNotFoundError(caseId);

        // 1. Transition READY -> AUTHENTICATING
        let updated = await this.transitionService.transition({
          caseId,
          toStatus: BookingCaseStatus.AUTHENTICATING,
          expectedFromStatus: BookingCaseStatus.READY,
          reason: 'Initiating provider authentication session.',
        });

        const context = this.buildContext(bookingCase, correlationId);
        const adapter = this.adapterResolver.resolve(context.providerRoute.providerCode);

        // 2. Call adapter authenticate
        const authResult = await adapter.authenticate(context);

        if (authResult.kind === 'HUMAN_ACTION_REQUIRED') {
          updated = await this.transitionService.transition({
            caseId,
            toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
            expectedFromStatus: BookingCaseStatus.AUTHENTICATING,
            reason: authResult.safeMessage ?? 'Provider requested human verification challenge.',
            metadata: {
              resumeToStatus: authResult.resumeToStatus,
              humanActionType: authResult.action,
              checkpoint: authResult.checkpoint,
            },
          });
          return { outcome: 'HUMAN_ACTION_REQUIRED', caseState: updated };
        }

        if (authResult.kind === 'PERMANENT_FAILURE') {
          updated = await this.transitionService.transition({
            caseId,
            toStatus: BookingCaseStatus.FAILED,
            expectedFromStatus: BookingCaseStatus.AUTHENTICATING,
            reason: authResult.safeMessage,
          });
          return { outcome: 'FAILED', caseState: updated };
        }

        if (authResult.kind === 'RETRYABLE_FAILURE') {
          return { outcome: 'RETRYABLE_FAILURE', caseState: updated };
        }

        // 3. Authenticated: inspect route and enter MONITORING or WAITING_QUEUE
        const routeInspection: RouteInspectionResult = await adapter.inspectRoute(context);
        const targetMode =
          routeInspection.kind === 'SUCCESS'
            ? routeInspection.data.bookingMode
            : context.providerRoute.bookingMode;

        const nextStatus =
          targetMode === BookingMode.WAITING_QUEUE
            ? BookingCaseStatus.WAITING_QUEUE
            : BookingCaseStatus.MONITORING;

        updated = await this.transitionService.transition({
          caseId,
          toStatus: nextStatus,
          expectedFromStatus: BookingCaseStatus.AUTHENTICATING,
          reason: `Authentication successful. Entering ${nextStatus} mode.`,
        });

        return { outcome: 'CONFIRMED', caseState: updated };
      },
    );
  }

  async executeAvailabilityCheck(
    caseId: string,
    correlationId?: string,
  ): Promise<{ outcome: OrchestrationExecutionOutcome; caseState: BookingCase; slot?: SlotCandidate }> {
    return this.lockService.withCaseLock(
      { caseId, ownerId: 'orch_engine', sessionId: 'avail' },
      async () => {
        // Idempotency check before executing
        const guardCheck = await this.idempotencyGuard.evaluateAvailabilityCheck(caseId);
        const bookingCase = await this.repo.findCaseById(caseId);
        if (!bookingCase) throw new BookingCaseNotFoundError(caseId);

        if (guardCheck.outcome === 'SKIPPED_ALREADY_APPLIED') {
          return { outcome: 'SKIPPED_ALREADY_APPLIED', caseState: bookingCase };
        }
        if (guardCheck.outcome === 'SKIPPED_STALE') {
          return { outcome: 'SKIPPED_STALE', caseState: bookingCase };
        }

        const context = this.buildContext(bookingCase, correlationId);
        const adapter = this.adapterResolver.resolve(context.providerRoute.providerCode);

        // Call checkAvailability
        const availResult = await adapter.checkAvailability(context);

        if (availResult.kind === 'SUCCESS') {
          const outcome = availResult.data.outcome;

          if (outcome === 'NO_SLOT') {
            // Case remains in MONITORING/WAITING_QUEUE. No state transition.
            return { outcome: 'PENDING_NO_SLOT', caseState: bookingCase };
          }

          if (outcome === 'GROUP_CAPACITY_MISMATCH') {
            // Group capacity mismatch: case remains in current state, returns structured result
            return { outcome: 'GROUP_CAPACITY_MISMATCH', caseState: bookingCase };
          }

          if (outcome === 'SLOT_FOUND') {
            const slot = availResult.data.slot;
            const updated = await this.transitionService.transition({
              caseId,
              toStatus: BookingCaseStatus.SLOT_FOUND,
              expectedFromStatus: bookingCase.status,
              reason: `Appointment slot detected for ${slot.date} at ${slot.centre || 'default centre'}.`,
              metadata: {
                slotCandidate: slot as any,
              },
            });
            return { outcome: 'SLOT_FOUND', caseState: updated, slot };
          }
        }

        return { outcome: 'PENDING_NO_SLOT', caseState: bookingCase };
      },
    );
  }

  async executeBooking(
    caseId: string,
    slotOverride?: SlotCandidate,
    correlationId?: string,
  ): Promise<{ outcome: OrchestrationExecutionOutcome; caseState: BookingCase }> {
    return this.lockService.withCaseLock(
      { caseId, ownerId: 'orch_engine', sessionId: 'book' },
      async () => {
        // 1. Idempotency guard check
        const guardCheck = await this.idempotencyGuard.evaluateBookingExecution(caseId);
        const bookingCase = await this.repo.findCaseById(caseId);
        if (!bookingCase) throw new BookingCaseNotFoundError(caseId);

        if (guardCheck.outcome === 'SKIPPED_ALREADY_APPLIED') {
          return { outcome: 'SKIPPED_ALREADY_APPLIED', caseState: bookingCase };
        }
        if (guardCheck.outcome === 'SKIPPED_STALE') {
          return { outcome: 'SKIPPED_STALE', caseState: bookingCase };
        }

        const context = this.buildContext(bookingCase, correlationId);
        const adapter = this.adapterResolver.resolve(context.providerRoute.providerCode);

        // Get latest history for slot metadata if not overridden
        let slot = slotOverride;
        if (!slot) {
          const history = await this.repo.getLatestStateHistory(caseId);
          const meta = (history?.metadata as Record<string, unknown>) || {};
          slot = (meta.slotCandidate as SlotCandidate) || {
            date: context.casePreferences.preferredDateFrom || '2026-11-15',
            time: '09:30',
          };
        }

        // 2. Transition SLOT_FOUND -> BOOKING
        let currentCase = await this.transitionService.transition({
          caseId,
          toStatus: BookingCaseStatus.BOOKING,
          expectedFromStatus: BookingCaseStatus.SLOT_FOUND,
          reason: 'Beginning provider reservation handoff.',
        });

        // 3. Begin booking
        const beginRes = await adapter.beginBooking(context, slot);
        if (beginRes.kind === 'SUCCESS' && beginRes.data.outcome === 'SLOT_LOST') {
          currentCase = await this.transitionService.transition({
            caseId,
            toStatus: BookingCaseStatus.SLOT_LOST,
            expectedFromStatus: BookingCaseStatus.BOOKING,
            reason: beginRes.data.reason ?? 'Appointment slot was claimed by another session.',
          });
          return { outcome: 'SLOT_LOST', caseState: currentCase };
        }

        // 4. Transition BOOKING -> ADDING_APPLICANTS
        currentCase = await this.transitionService.transition({
          caseId,
          toStatus: BookingCaseStatus.ADDING_APPLICANTS,
          expectedFromStatus: BookingCaseStatus.BOOKING,
          reason: 'Submitting applicant biographical data.',
        });

        const applicants = this.buildApplicantInputs(bookingCase);
        await adapter.addApplicants(context, applicants);

        // 5. Transition ADDING_APPLICANTS -> APPOINTMENT_SELECTED
        currentCase = await this.transitionService.transition({
          caseId,
          toStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
          expectedFromStatus: BookingCaseStatus.ADDING_APPLICANTS,
          reason: 'Confirmed appointment slot selection with provider.',
        });

        await adapter.selectAppointment(context, slot);

        // 6. Check payment state
        const paymentState = await adapter.getPaymentState(context);

        if (paymentState.kind === 'HUMAN_ACTION_REQUIRED') {
          currentCase = await this.transitionService.transition({
            caseId,
            toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
            expectedFromStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
            reason: paymentState.safeMessage ?? 'Provider requires OTP authentication for payment.',
            metadata: {
              resumeToStatus: paymentState.resumeToStatus,
              humanActionType: paymentState.action,
              checkpoint: paymentState.checkpoint,
            },
          });
          return { outcome: 'HUMAN_ACTION_REQUIRED', caseState: currentCase };
        }

        // Transition APPOINTMENT_SELECTED -> PAYMENT_REQUIRED
        currentCase = await this.transitionService.transition({
          caseId,
          toStatus: BookingCaseStatus.PAYMENT_REQUIRED,
          expectedFromStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
          reason: 'Appointment selected. Payment required to finalize booking.',
          metadata: {
            paymentState: paymentState.kind === 'SUCCESS' ? paymentState.data.paymentState : undefined,
          },
        });

        // If adapter is configured to stop at PAYMENT_REQUIRED:
        if (paymentState.kind === 'SUCCESS' && paymentState.data.paymentUrl) {
          return { outcome: 'PAYMENT_REQUIRED', caseState: currentCase };
        }

        // 7. Progress PAYMENT_REQUIRED -> PAYMENT_PROCESSING
        currentCase = await this.transitionService.transition({
          caseId,
          toStatus: BookingCaseStatus.PAYMENT_PROCESSING,
          expectedFromStatus: BookingCaseStatus.PAYMENT_REQUIRED,
          reason: 'Processing fee payment with provider.',
        });

        // 8. Progress PAYMENT_PROCESSING -> CONFIRMED
        const confirmation = await adapter.getConfirmation(context);
        const refNumber =
          confirmation.kind === 'SUCCESS'
            ? confirmation.data.referenceNumber
            : `CONF_${caseId.slice(-6)}`;

        currentCase = await this.transitionService.transition({
          caseId,
          toStatus: BookingCaseStatus.CONFIRMED,
          expectedFromStatus: BookingCaseStatus.PAYMENT_PROCESSING,
          reason: `Booking confirmed with provider. Reference: ${refNumber}.`,
          metadata: {
            referenceNumber: refNumber,
            confirmation: confirmation.kind === 'SUCCESS' ? confirmation.data : undefined,
          },
        });

        return { outcome: 'CONFIRMED', caseState: currentCase };
      },
    );
  }

  async executeResume(
    caseId: string,
    correlationId?: string,
  ): Promise<{ outcome: OrchestrationExecutionOutcome; caseState: BookingCase }> {
    return this.lockService.withCaseLock(
      { caseId, ownerId: 'orch_engine', sessionId: 'resume' },
      async () => {
        const guardCheck = await this.idempotencyGuard.evaluateSessionResume(caseId);
        const bookingCase = await this.repo.findCaseById(caseId);
        if (!bookingCase) throw new BookingCaseNotFoundError(caseId);

        if (guardCheck.outcome === 'SKIPPED_ALREADY_APPLIED') {
          return { outcome: 'SKIPPED_ALREADY_APPLIED', caseState: bookingCase };
        }

        const context = this.buildContext(bookingCase, correlationId);
        const adapter = this.adapterResolver.resolve(context.providerRoute.providerCode);

        // Resume adapter
        await adapter.resume(context);

        // Read checkpoint target from state history
        const latestHistory = await this.repo.getLatestStateHistory(caseId);
        const meta = (latestHistory?.metadata as Record<string, unknown>) || {};
        const resumeToStatus =
          (meta.resumeToStatus as BookingCaseStatus) || BookingCaseStatus.AUTHENTICATING;

        const updated = await this.transitionService.transition({
          caseId,
          toStatus: resumeToStatus,
          expectedFromStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
          reason: 'Human verification checkpoint completed. Resuming orchestration.',
        });

        return { outcome: 'CONFIRMED', caseState: updated };
      },
    );
  }
}

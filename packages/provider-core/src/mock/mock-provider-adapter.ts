import { BookingCaseStatus, BookingMode } from '@visaflow/shared-types';
import type { VisaProviderAdapter } from '../contracts/visa-provider-adapter.js';
import type { ProviderContext } from '../context/provider-context.js';
import type { AuthenticateResult } from '../types/authenticate-result.js';
import type { RouteInspectionResult } from '../types/route-inspection-result.js';
import type { AvailabilityResult } from '../types/availability-result.js';
import type { BookingResult } from '../types/booking-result.js';
import type { ProviderApplicantInput } from '../types/provider-applicant-input.js';
import type { ApplicantSubmissionResult } from '../types/applicant-submission-result.js';
import type { SlotCandidate } from '../types/slot-candidate.js';
import type { AppointmentSelectionResult } from '../types/appointment-selection-result.js';
import type { PaymentStateResult } from '../types/payment-state-result.js';
import type { ConfirmationResult } from '../types/confirmation-result.js';
import type { ResumeResult } from '../types/resume-result.js';
import { HumanActionType } from '../types/human-action-type.js';
import { MockScenario } from './mock-scenario.js';
import type { CaseMockState } from './mock-provider-state.js';

export class MockProviderAdapter implements VisaProviderAdapter {
  readonly adapterId = 'MOCK_PROVIDER_ADAPTER';

  private readonly caseStates = new Map<string, CaseMockState>();
  private defaultScenario: MockScenario = MockScenario.CONFIRMED;

  setDefaultScenario(scenario: MockScenario): void {
    this.defaultScenario = scenario;
  }

  setScenario(caseId: string, scenario: MockScenario): void {
    const state = this.getOrCreateState(caseId);
    state.scenario = scenario;
  }

  getScenario(caseId: string): MockScenario {
    return this.getOrCreateState(caseId).scenario;
  }

  getState(caseId: string): CaseMockState {
    return this.getOrCreateState(caseId);
  }

  reset(): void {
    this.caseStates.clear();
  }

  private getOrCreateState(caseId: string): CaseMockState {
    let state = this.caseStates.get(caseId);
    if (!state) {
      state = {
        caseId,
        scenario: this.defaultScenario,
        authenticated: false,
        humanActionCompleted: false,
      };
      this.caseStates.set(caseId, state);
    }
    return state;
  }

  async authenticate(context: ProviderContext): Promise<AuthenticateResult> {
    const state = this.getOrCreateState(context.caseId);

    if (state.scenario === MockScenario.CAPTCHA_REQUIRED && !state.humanActionCompleted) {
      return {
        kind: 'HUMAN_ACTION_REQUIRED',
        action: HumanActionType.CAPTCHA,
        resumeToStatus: BookingCaseStatus.AUTHENTICATING,
        safeMessage: 'Provider triggered Cloudflare verification challenge.',
        checkpoint: {
          challengeType: 'turnstile',
          stage: 'authentication',
        },
      };
    }

    state.authenticated = true;
    return {
      kind: 'SUCCESS',
      data: {
        sessionId: `mock_session_${context.caseId}`,
        authenticatedAt: '2026-09-14T12:00:00.000Z',
      },
    };
  }

  async inspectRoute(context: ProviderContext): Promise<RouteInspectionResult> {
    return {
      kind: 'SUCCESS',
      data: {
        routeSupported: true,
        bookingMode: context.providerRoute.bookingMode ?? BookingMode.APPOINTMENT_CALENDAR,
        metadata: {
          centreOpen: true,
        },
      },
    };
  }

  async checkAvailability(context: ProviderContext): Promise<AvailabilityResult> {
    const state = this.getOrCreateState(context.caseId);

    if (state.scenario === MockScenario.NO_SLOT) {
      return {
        kind: 'SUCCESS',
        data: {
          outcome: 'NO_SLOT',
        },
      };
    }

    if (state.scenario === MockScenario.GROUP_CAPACITY_MISMATCH) {
      return {
        kind: 'SUCCESS',
        data: {
          outcome: 'GROUP_CAPACITY_MISMATCH',
          requestedApplicants: context.applicantCount,
          maximumAvailableApplicants: Math.max(1, context.applicantCount - 1),
        },
      };
    }

    // Default or SLOT_FOUND / CONFIRMED / PAYMENT_REQUIRED / SLOT_LOST_DURING_BOOKING:
    const slot: SlotCandidate = {
      externalSlotId: `SLOT_DET_${context.caseId}`,
      date: context.casePreferences.preferredDateFrom || '2026-11-15',
      time: '09:30',
      centre: context.providerRoute.applicationCentre,
      capacity: Math.max(context.applicantCount, 5),
    };

    return {
      kind: 'SUCCESS',
      data: {
        outcome: 'SLOT_FOUND',
        slot,
      },
    };
  }

  async beginBooking(context: ProviderContext, _slot: SlotCandidate): Promise<BookingResult> {
    const state = this.getOrCreateState(context.caseId);

    if (state.scenario === MockScenario.SLOT_LOST_DURING_BOOKING) {
      return {
        kind: 'SUCCESS',
        data: {
          outcome: 'SLOT_LOST',
          reason: 'Slot was claimed by another session before reservation locked.',
        },
      };
    }

    state.bookingStarted = true;
    return {
      kind: 'SUCCESS',
      data: {
        outcome: 'STARTED',
        bookingSessionId: `mock_booking_${context.caseId}`,
      },
    };
  }

  async addApplicants(
    context: ProviderContext,
    applicants: ProviderApplicantInput[],
  ): Promise<ApplicantSubmissionResult> {
    const state = this.getOrCreateState(context.caseId);
    state.applicantsSubmitted = true;

    const providerApplicantIds: Record<string, string> = {};
    for (const applicant of applicants) {
      providerApplicantIds[applicant.id] = `prov_app_${applicant.position}`;
    }

    return {
      kind: 'SUCCESS',
      data: {
        submittedCount: applicants.length,
        providerApplicantIds,
      },
    };
  }

  async selectAppointment(
    context: ProviderContext,
    slot: SlotCandidate,
  ): Promise<AppointmentSelectionResult> {
    const state = this.getOrCreateState(context.caseId);
    state.slotSelected = true;

    return {
      kind: 'SUCCESS',
      data: {
        selectedSlot: slot,
        selectedAt: '2026-09-14T12:05:00.000Z',
      },
    };
  }

  async getPaymentState(context: ProviderContext): Promise<PaymentStateResult> {
    const state = this.getOrCreateState(context.caseId);

    if (state.scenario === MockScenario.OTP_REQUIRED && !state.humanActionCompleted) {
      return {
        kind: 'HUMAN_ACTION_REQUIRED',
        action: HumanActionType.OTP,
        resumeToStatus: BookingCaseStatus.PAYMENT_REQUIRED,
        safeMessage: 'Provider SMS OTP verification required to initiate payment.',
        checkpoint: {
          phoneMasked: '+2010****123',
          stage: 'payment',
        },
      };
    }

    if (state.scenario === MockScenario.PAYMENT_REQUIRED) {
      return {
        kind: 'SUCCESS',
        data: {
          paymentState: 'REQUIRED',
          amount: 1500,
          currency: 'EGP',
          paymentUrl: `https://provider.example.com/pay/${context.caseId}`,
        },
      };
    }

    // When in CONFIRMED scenario:
    if (!state.paymentInitiated) {
      state.paymentInitiated = true;
      return {
        kind: 'SUCCESS',
        data: {
          paymentState: 'REQUIRED',
          amount: 1500,
          currency: 'EGP',
        },
      };
    }

    return {
      kind: 'SUCCESS',
      data: {
        paymentState: 'PROCESSING',
        reference: `MOCK_TX_${context.caseId}`,
      },
    };
  }

  async getConfirmation(context: ProviderContext): Promise<ConfirmationResult> {
    return {
      kind: 'SUCCESS',
      data: {
        referenceNumber: `VF-CONF-${context.caseId.slice(-6).toUpperCase()}`,
        confirmedAt: '2026-09-14T12:10:00.000Z',
        appointmentDate: context.casePreferences.preferredDateFrom || '2026-11-15',
        appointmentTime: '09:30',
        centre: context.providerRoute.applicationCentre,
        documentUrls: [`https://provider.example.com/receipt/${context.caseId}`],
      },
    };
  }

  async resume(context: ProviderContext): Promise<ResumeResult> {
    const state = this.getOrCreateState(context.caseId);
    state.humanActionCompleted = true;

    return {
      kind: 'SUCCESS',
      data: {
        resumed: true,
        resumedAt: '2026-09-14T12:06:00.000Z',
      },
    };
  }
}

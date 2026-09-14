import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import {
  BookingCaseStatus,
  StateActorType,
} from '@visaflow/database';
import type { OrchestratorJobEnvelope } from '@visaflow/shared-types';
import type { WorkerConfig } from '../config/worker.config.js';
import { getRedisOptions } from '../config/worker.config.js';
import type { WorkerRepository } from '../repositories/worker.repository.js';
import type { ProviderContextLoaderService } from '../services/provider-context-loader.service.js';
import type { ProviderAdapterRegistryService } from '../services/provider-adapter-registry.service.js';
import type { AutomationSessionService } from '../services/automation-session.service.js';
import type { PaymentHandoffService } from '../services/payment-handoff.service.js';
import { QUEUE_NAMES } from './queue.constants.js';

import type { SlotCandidate } from '@visaflow/provider-core';

export class BookingWorker {
  private worker?: Worker;
  private redisClient?: Redis;

  constructor(
    private readonly config: WorkerConfig,
    private readonly repo: WorkerRepository,
    private readonly contextLoader: ProviderContextLoaderService,
    private readonly adapterRegistry: ProviderAdapterRegistryService,
    private readonly sessionService: AutomationSessionService,
    private readonly paymentHandoffService: PaymentHandoffService,
  ) {}

  start(): void {
    this.redisClient = new Redis(this.config.redisUrl, getRedisOptions(this.config.redisUrl));

    this.worker = new Worker(
      QUEUE_NAMES.BOOKING_EXECUTION,
      async (job: Job<OrchestratorJobEnvelope<{ slot: SlotCandidate }>>) => {
        return this.processJob(job);
      },
      {
        connection: this.redisClient,
        prefix: this.config.queuePrefix,
        concurrency: 1,
      },
    );
  }

  async processJob(job: Job<OrchestratorJobEnvelope<{ slot: SlotCandidate }>>): Promise<{ outcome: string }> {
    const envelope = job.data;
    const caseId = envelope.caseId;
    const slot = envelope.payload.slot;

    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      return { outcome: 'CASE_NOT_FOUND' };
    }

    // Idempotency check: booking must begin strictly from SLOT_FOUND
    if (bookingCase.status !== BookingCaseStatus.SLOT_FOUND) {
      return { outcome: 'SKIPPED_ALREADY_APPLIED' };
    }

    const { context, applicants } = await this.contextLoader.loadContextAndApplicants(
      caseId,
      envelope.correlationId,
    );
    const adapter = this.adapterRegistry.resolve(context.providerRoute.providerCode);

    // 1. Transition SLOT_FOUND -> BOOKING
    await this.repo.atomicConditionalTransition({
      caseId,
      fromStatus: BookingCaseStatus.SLOT_FOUND,
      toStatus: BookingCaseStatus.BOOKING,
      actorType: StateActorType.WORKER,
      actorId: this.config.workerId,
      reason: 'Worker beginning remote booking initialization',
      metadata: { slot },
    });

    // 2. beginBooking()
    const beginRes = await adapter.beginBooking(context, slot);
    if (
      (beginRes.kind === 'SUCCESS' && (beginRes as any).data?.outcome === 'SLOT_LOST') ||
      (beginRes.kind === 'RETRYABLE_FAILURE' && beginRes.code === 'SLOT_LOST')
    ) {
      await this.repo.atomicConditionalTransition({
        caseId,
        fromStatus: BookingCaseStatus.BOOKING,
        toStatus: BookingCaseStatus.SLOT_LOST,
        actorType: StateActorType.WORKER,
        actorId: this.config.workerId,
        reason: 'Target slot became unavailable during booking initialization',
      });
      return { outcome: 'SLOT_LOST' };
    }


    // 3. Transition BOOKING -> ADDING_APPLICANTS
    await this.repo.atomicConditionalTransition({
      caseId,
      fromStatus: BookingCaseStatus.BOOKING,
      toStatus: BookingCaseStatus.ADDING_APPLICANTS,
      actorType: StateActorType.WORKER,
      actorId: this.config.workerId,
      reason: 'Entering applicant details on provider form',
    });

    // 4. addApplicants()
    const applicantsRes = await adapter.addApplicants(context, applicants);
    if (applicantsRes.kind === 'HUMAN_ACTION_REQUIRED') {
      await this.repo.atomicConditionalTransition({
        caseId,
        fromStatus: BookingCaseStatus.ADDING_APPLICANTS,
        toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
        actorType: StateActorType.WORKER,
        actorId: this.config.workerId,
        reason: applicantsRes.safeMessage ?? null,
        metadata: { resumeToStatus: applicantsRes.resumeToStatus, humanActionType: applicantsRes.action },
      });
      return { outcome: 'HUMAN_ACTION_REQUIRED' };
    }

    // 5. Transition ADDING_APPLICANTS -> APPOINTMENT_SELECTED
    await this.repo.atomicConditionalTransition({
      caseId,
      fromStatus: BookingCaseStatus.ADDING_APPLICANTS,
      toStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
      actorType: StateActorType.WORKER,
      actorId: this.config.workerId,
      reason: 'Applicant details submitted; selecting appointment slot',
    });

    // 6. selectAppointment()
    const selectRes = await adapter.selectAppointment(context, slot);
    if (selectRes.kind === 'RETRYABLE_FAILURE' && selectRes.code === 'SLOT_LOST') {
      await this.repo.atomicConditionalTransition({
        caseId,
        fromStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
        toStatus: BookingCaseStatus.SLOT_LOST,
        actorType: StateActorType.WORKER,
        actorId: this.config.workerId,
        reason: 'Slot lost during appointment selection',
      });
      return { outcome: 'SLOT_LOST' };
    }

    // 7. getPaymentState()
    const paymentRes = await adapter.getPaymentState(context);
    if (paymentRes.kind === 'HUMAN_ACTION_REQUIRED') {
      await this.repo.atomicConditionalTransition({
        caseId,
        fromStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
        toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
        actorType: StateActorType.WORKER,
        actorId: this.config.workerId,
        reason: paymentRes.safeMessage ?? null,
        metadata: { resumeToStatus: paymentRes.resumeToStatus, humanActionType: paymentRes.action },
      });
      return { outcome: 'HUMAN_ACTION_REQUIRED' };
    }

    // 8. Transition APPOINTMENT_SELECTED -> PAYMENT_REQUIRED
    await this.repo.atomicConditionalTransition({
      caseId,
      fromStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
      toStatus: BookingCaseStatus.PAYMENT_REQUIRED,
      actorType: StateActorType.WORKER,
      actorId: this.config.workerId,
      reason: 'Appointment selected; awaiting manual payment completion',
      metadata: {
        paymentState: paymentRes.kind === 'SUCCESS' ? paymentRes.data : undefined,
      },
    });

    // Persist PaymentHandoff and update AutomationSession
    const activeSession = await this.repo.findActiveSessionByCaseId(caseId);
    if (activeSession) {
      await this.sessionService.recordPaymentHandoff({
        sessionId: activeSession.id,
      });

      const amount = paymentRes.kind === 'SUCCESS' ? paymentRes.data.amount : undefined;
      const currency = paymentRes.kind === 'SUCCESS' ? paymentRes.data.currency : undefined;
      const ref = paymentRes.kind === 'SUCCESS' ? paymentRes.data.reference : undefined;

      await this.paymentHandoffService.createHandoff({
        bookingCaseId: caseId,
        automationSessionId: activeSession.id,
        ...(amount !== undefined ? { amount } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(ref !== undefined ? { externalReference: ref } : {}),
      });
    }


    return { outcome: 'PAYMENT_REQUIRED' };
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.redisClient?.quit();
  }
}

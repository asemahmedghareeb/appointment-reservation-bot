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
import { QUEUE_NAMES, deriveDeterministicJobId } from './queue.constants.js';
import { Queue } from 'bullmq';


export class AvailabilityWorker {
  private worker?: Worker;
  private redisClient?: Redis;
  private bookingQueue?: Queue;

  constructor(
    private readonly config: WorkerConfig,
    private readonly repo: WorkerRepository,
    private readonly contextLoader: ProviderContextLoaderService,
    private readonly adapterRegistry: ProviderAdapterRegistryService,
    private readonly sessionService: AutomationSessionService,
  ) {}

  start(): void {
    this.redisClient = new Redis(this.config.redisUrl, getRedisOptions(this.config.redisUrl));
    this.bookingQueue = new Queue(QUEUE_NAMES.BOOKING_EXECUTION, {
      connection: this.redisClient,
      prefix: this.config.queuePrefix,
    });

    this.worker = new Worker(
      QUEUE_NAMES.AVAILABILITY_CHECK,
      async (job: Job<OrchestratorJobEnvelope>) => {
        return this.processJob(job);
      },
      {
        connection: this.redisClient,
        prefix: this.config.queuePrefix,
        concurrency: 2,
      },
    );
  }

  async processJob(job: Job<OrchestratorJobEnvelope>): Promise<{ outcome: string }> {
    const envelope = job.data;
    const caseId = envelope.caseId;

    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      return { outcome: 'CASE_NOT_FOUND' };
    }

    // Idempotency check: only process if status is READY, MONITORING, or WAITING_QUEUE
    if (
      bookingCase.status !== BookingCaseStatus.READY &&
      bookingCase.status !== BookingCaseStatus.MONITORING &&
      bookingCase.status !== BookingCaseStatus.WAITING_QUEUE
    ) {
      return { outcome: 'SKIPPED_ALREADY_APPLIED' };
    }

    const { context } = await this.contextLoader.loadContextAndApplicants(caseId, envelope.correlationId);
    const adapter = this.adapterRegistry.resolve(context.providerRoute.providerCode);

    // If starting from READY, authenticate and inspect route first
    if (bookingCase.status === BookingCaseStatus.READY) {
      await this.repo.atomicConditionalTransition({
        caseId,
        fromStatus: BookingCaseStatus.READY,
        toStatus: BookingCaseStatus.AUTHENTICATING,
        actorType: StateActorType.WORKER,
        actorId: this.config.workerId,
        reason: 'Worker beginning provider authentication',
      });

      // Create automation session
      await this.sessionService.createSession({
        bookingCaseId: caseId,
        providerAccountId: context.providerAccountId,
        providerCode: context.providerRoute.providerCode,
      });

      const authRes = await adapter.authenticate(context);
      if (authRes.kind === 'HUMAN_ACTION_REQUIRED') {
        await this.repo.atomicConditionalTransition({
          caseId,
          fromStatus: BookingCaseStatus.AUTHENTICATING,
          toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
          actorType: StateActorType.WORKER,
          actorId: this.config.workerId,
          reason: authRes.safeMessage ?? 'Human challenge during authentication',
          metadata: {
            resumeToStatus: authRes.resumeToStatus,
            humanActionType: authRes.action,
            checkpoint: authRes.checkpoint,
          },
        });

        const activeSession = await this.repo.findActiveSessionByCaseId(caseId);
        if (activeSession) {
          await this.sessionService.recordHumanVerificationCheckpoint({
            sessionId: activeSession.id,
            humanActionType: authRes.action,
            resumeToStatus: authRes.resumeToStatus,
            checkpoint: authRes.checkpoint,
          });
        }

        return { outcome: 'HUMAN_ACTION_REQUIRED' };
      }

      if (authRes.kind === 'PERMANENT_FAILURE') {
        await this.repo.atomicConditionalTransition({
          caseId,
          fromStatus: BookingCaseStatus.AUTHENTICATING,
          toStatus: BookingCaseStatus.FAILED,
          actorType: StateActorType.WORKER,
          actorId: this.config.workerId,
          reason: authRes.safeMessage,
        });
        return { outcome: 'FAILED' };
      }

      if (authRes.kind === 'RETRYABLE_FAILURE') {
        await this.repo.recordActivityLog({
          bookingCaseId: caseId,
          actorType: StateActorType.WORKER,
          actorId: this.config.workerId,
          eventType: 'AUTOMATION_ERROR',
          message: authRes.safeMessage || 'فشلت محاولة تسجيل الدخول لمزود الخدمة، سيتم إعادة المحاولة',
        });
        throw new Error(authRes.safeMessage || 'Authentication failed (retryable)');
      }

      // Route inspection
      const inspectRes = await adapter.inspectRoute(context);
      if (inspectRes.kind === 'HUMAN_ACTION_REQUIRED') {
        await this.repo.atomicConditionalTransition({
          caseId,
          fromStatus: BookingCaseStatus.AUTHENTICATING,
          toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
          actorType: StateActorType.WORKER,
          actorId: this.config.workerId,
          reason: inspectRes.safeMessage,
          metadata: { resumeToStatus: inspectRes.resumeToStatus, humanActionType: inspectRes.action },
        });
        return { outcome: 'HUMAN_ACTION_REQUIRED' };
      }

      if (inspectRes.kind === 'PERMANENT_FAILURE') {
        await this.repo.atomicConditionalTransition({
          caseId,
          fromStatus: BookingCaseStatus.AUTHENTICATING,
          toStatus: BookingCaseStatus.FAILED,
          actorType: StateActorType.WORKER,
          actorId: this.config.workerId,
          reason: inspectRes.safeMessage,
        });
        return { outcome: 'FAILED' };
      }

      if (inspectRes.kind === 'RETRYABLE_FAILURE') {
        await this.repo.recordActivityLog({
          bookingCaseId: caseId,
          actorType: StateActorType.WORKER,
          actorId: this.config.workerId,
          eventType: 'AUTOMATION_ERROR',
          message: inspectRes.safeMessage || 'فحص المسار قيد المحاولة مجدداً',
        });
        throw new Error(inspectRes.safeMessage || 'Route inspection failed (retryable)');
      }

      const nextStatus = context.providerRoute.bookingMode === 'WAITING_QUEUE'
        ? BookingCaseStatus.WAITING_QUEUE
        : BookingCaseStatus.MONITORING;

      await this.repo.atomicConditionalTransition({
        caseId,
        fromStatus: BookingCaseStatus.AUTHENTICATING,
        toStatus: nextStatus,
        actorType: StateActorType.WORKER,
        actorId: this.config.workerId,
        reason: 'Authentication and route inspection completed successfully',
      });
    }

    // Now check availability
    const availRes = await adapter.checkAvailability(context);
    if (availRes.kind === 'HUMAN_ACTION_REQUIRED') {
      await this.repo.atomicConditionalTransition({
        caseId,
        fromStatus: BookingCaseStatus.MONITORING,
        toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
        actorType: StateActorType.WORKER,
        actorId: this.config.workerId,
        reason: availRes.safeMessage,
        metadata: { resumeToStatus: availRes.resumeToStatus, humanActionType: availRes.action },
      });
      return { outcome: 'HUMAN_ACTION_REQUIRED' };
    }

    if (availRes.kind === 'SUCCESS') {
      if (availRes.data.outcome === 'SLOT_FOUND') {
        const slot = availRes.data.slot;

        await this.repo.atomicConditionalTransition({
          caseId,
          fromStatus: BookingCaseStatus.MONITORING,
          toStatus: BookingCaseStatus.SLOT_FOUND,
          actorType: StateActorType.WORKER,

          actorId: this.config.workerId,
          reason: `Slot discovered: ${slot.date} ${slot.time ?? ''}`,
          metadata: { slot },
        });

        // Enqueue booking execution
        const bookingIdempotencyKey = `${caseId}:booking:${slot.date}:${envelope.cycleId}`;
        const bookingJobId = deriveDeterministicJobId(bookingIdempotencyKey);


        if (this.bookingQueue) {
          await this.bookingQueue.add(
            'booking-execution',
            {
              version: 1,
              jobType: 'BOOKING_EXECUTION',
              caseId,
              correlationId: envelope.correlationId,
              cycleId: envelope.cycleId,
              idempotencyKey: bookingIdempotencyKey,
              expectedStatuses: [BookingCaseStatus.SLOT_FOUND],
              createdAt: new Date().toISOString(),
              payload: { slot },
            },
            {
              jobId: bookingJobId,
              attempts: 3,
            },
          );
        }

        return { outcome: 'SLOT_FOUND' };
      }

      if (availRes.data.outcome === 'GROUP_CAPACITY_MISMATCH') {
        return { outcome: 'GROUP_CAPACITY_MISMATCH' };
      }

      return { outcome: 'NO_SLOT' };
    }

    return { outcome: 'AVAILABILITY_ERROR' };
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.bookingQueue?.close();
    await this.redisClient?.quit();
  }
}

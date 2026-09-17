import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import {
  BookingCaseStatus,
  StateActorType,
} from '@visaflow/database';
import { OrchestratorJobType, type OrchestratorJobEnvelope } from '@visaflow/shared-types';
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
  private queueRedisClient?: Redis;
  private bookingQueue?: Queue;

  constructor(
    private readonly config: WorkerConfig,
    private readonly repo: WorkerRepository,
    private readonly contextLoader: ProviderContextLoaderService,
    private readonly adapterRegistry: ProviderAdapterRegistryService,
    private readonly sessionService: AutomationSessionService,
  ) {}

  start(): void {
    const redisOpts = getRedisOptions(this.config.redisUrl);
    this.redisClient = new Redis(this.config.redisUrl, redisOpts);
    this.redisClient.on('error', (err) => {
      console.warn('[AvailabilityWorker Worker Redis]', err.message);
    });

    this.queueRedisClient = new Redis(this.config.redisUrl, redisOpts);
    this.queueRedisClient.on('error', (err) => {
      console.warn('[AvailabilityWorker Queue Redis]', err.message);
    });

    this.bookingQueue = new Queue(QUEUE_NAMES.BOOKING_EXECUTION, {
      connection: this.queueRedisClient,
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

    this.worker.on('error', (err) => {
      console.warn('[AvailabilityWorker BullMQ]', err.message);
    });
  }

  async processJob(job: Job<OrchestratorJobEnvelope>): Promise<{ outcome: string }> {
    const envelope = job.data;
    const caseId = envelope.caseId;

    if (envelope.jobType === OrchestratorJobType.PREPARE_LOGIN) {
      return this.processPrepareLogin(envelope);
    }

    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      return { outcome: 'CASE_NOT_FOUND' };
    }

    // Idempotency check: only process if status is READY, MONITORING, WAITING_QUEUE, or AUTHENTICATING
    // AUTHENTICATING is allowed so that BullMQ retry attempts can re-run authenticate() after transient failures
    if (
      bookingCase.status !== BookingCaseStatus.READY &&
      bookingCase.status !== BookingCaseStatus.MONITORING &&
      bookingCase.status !== BookingCaseStatus.WAITING_QUEUE &&
      bookingCase.status !== BookingCaseStatus.AUTHENTICATING
    ) {
      return { outcome: 'SKIPPED_ALREADY_APPLIED' };
    }

    const { context } = await this.contextLoader.loadContextAndApplicants(caseId, envelope.correlationId);
    const adapter = this.adapterRegistry.resolve(context.providerRoute.providerCode);

    // If starting from READY or AUTHENTICATING (retry case), authenticate and inspect route first
    if (bookingCase.status === BookingCaseStatus.READY || bookingCase.status === BookingCaseStatus.AUTHENTICATING) {
      // Only transition from READY; if already AUTHENTICATING, just proceed
      if (bookingCase.status === BookingCaseStatus.READY) {
        await this.repo.atomicConditionalTransition({
          caseId,
          fromStatus: BookingCaseStatus.READY,
          toStatus: BookingCaseStatus.AUTHENTICATING,
          actorType: StateActorType.WORKER,
          actorId: this.config.workerId,
          reason: 'Worker beginning provider authentication',
        });

        // Create automation session only if not already active
        const existingSession = await this.repo.findActiveSessionByCaseId(caseId);
        if (!existingSession) {
          await this.sessionService.createSession({
            bookingCaseId: caseId,
            providerAccountId: context.providerAccountId,
            providerCode: context.providerRoute.providerCode,
          });
        }
      }


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

  private async processPrepareLogin(envelope: OrchestratorJobEnvelope): Promise<{ outcome: string }> {
    const caseId = envelope.caseId;
    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      return { outcome: 'CASE_NOT_FOUND' };
    }

    const { context } = await this.contextLoader.loadContextAndApplicants(caseId, envelope.correlationId);
    const adapter = this.adapterRegistry.resolve(context.providerRoute.providerCode);

    // Call adapter to launch session and navigate to VFS login URL
    const session = await (adapter as any).prepareLoginSession(context);

    // Record activity log
    await this.repo.recordActivityLog({
      bookingCaseId: caseId,
      actorType: StateActorType.WORKER,
      actorId: this.config.workerId,
      eventType: 'LOGIN_SESSION_PREPARED',
      message: 'تم فتح جلسة VFS بنجاح، بانتظار تسجيل الدخول اليدوي من المشغل',
    });

    // Start passive observation on the session page to auto-detect successful login
    this.startAuthObserver(caseId, session, adapter);

    return { outcome: 'LOGIN_SESSION_PREPARED' };
  }

  private startAuthObserver(caseId: string, session: any, adapter: any): void {
    if (!session || !session.page || session.page.isClosed()) return;

    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped || !session.page || session.page.isClosed()) {
        clearInterval(interval);
        return;
      }

      try {
        const isAuth = await adapter.isSessionAuthenticated(caseId);
        if (isAuth) {
          stopped = true;
          clearInterval(interval);

          const activeSession = await this.repo.findActiveSessionByCaseId(caseId);
          if (activeSession) {
            await this.repo.updateAutomationSession(activeSession.id, {
              status: 'ACTIVE',
              checkpointJson: {
                step: 'READY_FOR_AUTOMATION',
                authenticated: true,
                detectedAt: new Date().toISOString(),
              },
              humanActionType: null,
              lastHeartbeatAt: new Date(),
            });

            await this.repo.recordActivityLog({
              bookingCaseId: caseId,
              actorType: StateActorType.WORKER,
              actorId: this.config.workerId,
              eventType: 'LOGIN_SUCCESS_DETECTED',
              message: 'تم تسجيل الدخول بنجاح إلى VFS، الجلسة جاهزة لتشغيل البوت',
            });
          }
        }
      } catch {
        // Ignore check errors
      }
    }, 2500);

    // Auto cleanup observer after 25 minutes
    setTimeout(() => {
      if (!stopped) {
        stopped = true;
        clearInterval(interval);
      }
    }, 25 * 60 * 1000);
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.bookingQueue?.close();
    await this.redisClient?.quit();
    await this.queueRedisClient?.quit();
  }
}

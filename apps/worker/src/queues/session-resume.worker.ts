import { Worker, Queue, type Job } from 'bullmq';
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
import { QUEUE_NAMES } from './queue.constants.js';


export class SessionResumeWorker {
  private worker?: Worker;
  private redisClient?: Redis;
  private queueRedisClient?: Redis;
  private availabilityQueue?: Queue;

  constructor(
    private readonly config: WorkerConfig,
    private readonly repo: WorkerRepository,
    private readonly contextLoader: ProviderContextLoaderService,
    private readonly adapterRegistry: ProviderAdapterRegistryService,
    private readonly sessionService: AutomationSessionService,
  ) {}

  start(): void {
    this.redisClient = new Redis(this.config.redisUrl, getRedisOptions(this.config.redisUrl));
    this.redisClient.on('error', (err) => {
      console.warn('[SessionResumeWorker Redis]', err.message);
    });

    this.queueRedisClient = new Redis(this.config.redisUrl, getRedisOptions(this.config.redisUrl));
    this.queueRedisClient.on('error', (err) => {
      console.warn('[SessionResumeWorker Queue Redis]', err.message);
    });

    this.availabilityQueue = new Queue(QUEUE_NAMES.AVAILABILITY_CHECK, {
      connection: this.queueRedisClient,
      prefix: this.config.queuePrefix,
    });

    this.worker = new Worker(
      QUEUE_NAMES.SESSION_RESUME,
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
      console.warn('[SessionResumeWorker BullMQ]', err.message);
    });
  }

  async processJob(job: Job<OrchestratorJobEnvelope>): Promise<{ outcome: string }> {
    const envelope = job.data;
    const caseId = envelope.caseId;

    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      return { outcome: 'CASE_NOT_FOUND' };
    }

    // Check case is currently HUMAN_VERIFICATION_REQUIRED or PAYMENT_REQUIRED
    if (
      bookingCase.status !== BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED &&
      bookingCase.status !== BookingCaseStatus.PAYMENT_REQUIRED
    ) {
      return { outcome: 'SKIPPED_ALREADY_APPLIED' };
    }

    const activeSession = await this.repo.findActiveSessionByCaseId(caseId);
    if (!activeSession) {
      return { outcome: 'NO_ACTIVE_SESSION' };
    }

    // Check worker ownership
    if (!this.sessionService.assertSessionOwnership(activeSession.workerId)) {
      return { outcome: 'SESSION_OWNER_MISMATCH' };
    }

    const { context, applicants } = await this.contextLoader.loadContextAndApplicants(
      caseId,
      envelope.correlationId,
    );
    const adapter = this.adapterRegistry.resolve(context.providerRoute.providerCode);

    if (bookingCase.status === BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED) {
      const resumeRes = await adapter.resume(context);
      if (resumeRes.kind === 'HUMAN_ACTION_REQUIRED') {
        return { outcome: 'HUMAN_ACTION_STILL_REQUIRED' };
      }

      // Validated resume target from active session
      const targetStatus = activeSession.resumeToStatus ?? BookingCaseStatus.MONITORING;

      await this.repo.atomicConditionalTransition({
        caseId,
        fromStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
        toStatus: targetStatus,
        actorType: StateActorType.WORKER,
        actorId: this.config.workerId,
        reason: 'Human verification completed; resuming automation session',
      });

      if (this.availabilityQueue) {
        await this.availabilityQueue.add(
          OrchestratorJobType.AVAILABILITY_CHECK,
          {
            caseId,
            correlationId: envelope.correlationId,
            cycleId: envelope.cycleId,
            idempotencyKey: `${caseId}:avail:${Date.now()}`,
            jobType: OrchestratorJobType.AVAILABILITY_CHECK,
            payload: {
              applicantCount: applicants.length || 1,
            },
          },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        );
      }

      return { outcome: 'RESUMED' };
    }

    // If case is in PAYMENT_REQUIRED and user resumes after manual payment completion:
    if (bookingCase.status === BookingCaseStatus.PAYMENT_REQUIRED) {
      const paymentRes = await adapter.getPaymentState(context);
      if (paymentRes.kind === 'SUCCESS' && (paymentRes.data.paymentState === 'PAID' || paymentRes.data.paymentState === 'PROCESSING')) {
        await this.repo.atomicConditionalTransition({
          caseId,
          fromStatus: BookingCaseStatus.PAYMENT_REQUIRED,
          toStatus: BookingCaseStatus.PAYMENT_PROCESSING,
          actorType: StateActorType.WORKER,
          actorId: this.config.workerId,
          reason: 'Manual payment completed; confirming appointment',
        });

        const confirmRes = await adapter.getConfirmation(context);
        if (confirmRes.kind === 'SUCCESS') {
          await this.repo.atomicConditionalTransition({
            caseId,
            fromStatus: BookingCaseStatus.PAYMENT_PROCESSING,
            toStatus: BookingCaseStatus.CONFIRMED,
            actorType: StateActorType.WORKER,
            actorId: this.config.workerId,
            reason: `Appointment confirmed: ${confirmRes.data.referenceNumber}`,
            metadata: {
              referenceNumber: confirmRes.data.referenceNumber,
              appointmentDate: confirmRes.data.appointmentDate,
            },
          });

          await this.sessionService.completeSession(activeSession.id);
          return { outcome: 'CONFIRMED' };
        }
      }

      return { outcome: 'PAYMENT_PENDING' };
    }

    return { outcome: 'UNKNOWN_STATE' };
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.availabilityQueue?.close();
    await this.redisClient?.quit();
    await this.queueRedisClient?.quit();
  }
}

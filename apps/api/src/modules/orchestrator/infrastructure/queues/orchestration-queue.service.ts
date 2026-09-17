import { Injectable, Inject, OnModuleDestroy, Optional } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  OrchestratorJobType,
  type OrchestratorJobEnvelope,
  BookingCaseStatus,
} from '@visaflow/shared-types';
import { REDIS_QUEUE_CLIENT } from '../redis/redis.tokens.js';
import { QueueFactory } from './queue.factory.js';
import { deriveDeterministicJobId } from './queue-job-id.js';
import type { AvailabilityCheckJobPayload } from './jobs/availability-check.job.js';
import type { BookingExecutionJobPayload } from './jobs/booking-execution.job.js';
import type { SessionResumeJobPayload } from './jobs/session-resume.job.js';

export interface EnqueueParams<TPayload> {
  caseId: string;
  correlationId: string;
  cycleId: string;
  idempotencyKey: string;
  payload: TPayload;
}

@Injectable()
export class OrchestrationQueueService implements OnModuleDestroy {
  private readonly factory: QueueFactory;

  constructor(
    @Inject(REDIS_QUEUE_CLIENT) redisClient: Redis,
    @Optional() prefixOverride?: string,
  ) {
    this.factory = new QueueFactory(redisClient, prefixOverride);
  }

  getFactory(): QueueFactory {
    return this.factory;
  }

  async enqueueAvailabilityCheck(
    params: EnqueueParams<AvailabilityCheckJobPayload>,
  ): Promise<{ jobId: string; queueName: string }> {
    const queue = this.factory.getAvailabilityQueue();
    const jobId = deriveDeterministicJobId(params.idempotencyKey);

    const envelope: OrchestratorJobEnvelope<AvailabilityCheckJobPayload> = {
      version: 1,
      jobType: OrchestratorJobType.AVAILABILITY_CHECK,
      caseId: params.caseId,
      correlationId: params.correlationId,
      cycleId: params.cycleId,
      idempotencyKey: params.idempotencyKey,
      expectedStatuses: [BookingCaseStatus.READY, BookingCaseStatus.MONITORING, BookingCaseStatus.WAITING_QUEUE],

      createdAt: new Date().toISOString(),
      payload: params.payload,
    };

    const job = await queue.add(OrchestratorJobType.AVAILABILITY_CHECK, envelope, {
      jobId,
    });

    return { jobId: job.id || jobId, queueName: queue.name };
  }

  async enqueuePrepareLogin(
    params: EnqueueParams<AvailabilityCheckJobPayload>,
  ): Promise<{ jobId: string; queueName: string }> {
    const queue = this.factory.getAvailabilityQueue();
    const jobId = deriveDeterministicJobId(params.idempotencyKey);

    const envelope: OrchestratorJobEnvelope<AvailabilityCheckJobPayload> = {
      version: 1,
      jobType: OrchestratorJobType.PREPARE_LOGIN,
      caseId: params.caseId,
      correlationId: params.correlationId,
      cycleId: params.cycleId,
      idempotencyKey: params.idempotencyKey,
      expectedStatuses: [BookingCaseStatus.READY, BookingCaseStatus.AUTHENTICATING],
      createdAt: new Date().toISOString(),
      payload: params.payload,
    };

    const job = await queue.add(OrchestratorJobType.PREPARE_LOGIN, envelope, {
      jobId,
    });

    return { jobId: job.id || jobId, queueName: queue.name };
  }

  async enqueueBookingExecution(
    params: EnqueueParams<BookingExecutionJobPayload>,
  ): Promise<{ jobId: string; queueName: string }> {
    const queue = this.factory.getBookingQueue();
    const jobId = deriveDeterministicJobId(params.idempotencyKey);

    const envelope: OrchestratorJobEnvelope<BookingExecutionJobPayload> = {
      version: 1,
      jobType: OrchestratorJobType.BOOKING_EXECUTION,
      caseId: params.caseId,
      correlationId: params.correlationId,
      cycleId: params.cycleId,
      idempotencyKey: params.idempotencyKey,
      expectedStatuses: [BookingCaseStatus.SLOT_FOUND],
      createdAt: new Date().toISOString(),
      payload: params.payload,
    };

    const job = await queue.add(OrchestratorJobType.BOOKING_EXECUTION, envelope, {
      jobId,
    });

    return { jobId: job.id || jobId, queueName: queue.name };
  }

  async enqueueSessionResume(
    params: EnqueueParams<SessionResumeJobPayload>,
  ): Promise<{ jobId: string; queueName: string }> {
    const queue = this.factory.getResumeQueue();
    const jobId = deriveDeterministicJobId(params.idempotencyKey);

    const envelope: OrchestratorJobEnvelope<SessionResumeJobPayload> = {
      version: 1,
      jobType: OrchestratorJobType.SESSION_RESUME,
      caseId: params.caseId,
      correlationId: params.correlationId,
      cycleId: params.cycleId,
      idempotencyKey: params.idempotencyKey,
      expectedStatuses: [BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED],
      createdAt: new Date().toISOString(),
      payload: params.payload,
    };

    const job = await queue.add(OrchestratorJobType.SESSION_RESUME, envelope, {
      jobId,
    });

    return { jobId: job.id || jobId, queueName: queue.name };
  }

  async onModuleDestroy(): Promise<void> {
    await this.factory.closeAll();
  }
}

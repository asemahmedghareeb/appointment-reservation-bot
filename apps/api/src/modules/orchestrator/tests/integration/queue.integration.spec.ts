import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { createRedisQueueClient } from '../../infrastructure/redis/redis-client.factory.js';
import { OrchestrationQueueService } from '../../infrastructure/queues/orchestration-queue.service.js';
import { deriveDeterministicJobId } from '../../infrastructure/queues/queue-job-id.js';

describe('BullMQ Queue Integration Test', () => {
  let redis: Redis;
  let queueService: OrchestrationQueueService;
  const testRunId = randomUUID().slice(0, 8);
  const testPrefix = `visaflow:test:${testRunId}`;

  beforeAll(async () => {
    redis = createRedisQueueClient();
    try {
      await redis.connect();
    } catch {
      // lazy or connected
    }

    queueService = new OrchestrationQueueService(redis, testPrefix);
  });

  afterAll(async () => {
    // Safely drain and obliterate test queues
    const factory = queueService.getFactory();
    const q1 = factory.getAvailabilityQueue();
    await q1.obliterate({ force: true }).catch(() => {});
    await factory.closeAll().catch(() => {});
    await redis.quit().catch(() => {});
  });

  it('enqueues availability check and verifies custom job ID and envelope', async () => {
    const idempotencyKey = `case_${testRunId}:cycle_1:avail`;
    const expectedJobId = deriveDeterministicJobId(idempotencyKey);

    const { jobId } = await queueService.enqueueAvailabilityCheck({
      caseId: `case_${testRunId}`,
      correlationId: `corr_${testRunId}`,
      cycleId: 'cycle_1',
      idempotencyKey,
      payload: {
        applicantCount: 3,
        preferredDateFrom: '2026-11-01',
      },
    });

    expect(jobId).toBe(expectedJobId);

    // Retrieve job from queue
    const queue = queueService.getFactory().getAvailabilityQueue();
    const retrievedJob = await queue.getJob(expectedJobId);

    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.id).toBe(expectedJobId);
    expect(retrievedJob?.data.jobType).toBe('AVAILABILITY_CHECK');
    expect(retrievedJob?.data.caseId).toBe(`case_${testRunId}`);
    expect(retrievedJob?.data.payload.applicantCount).toBe(3);
  });
});

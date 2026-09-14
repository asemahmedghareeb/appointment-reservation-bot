import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { OrchestrationQueueService } from '../infrastructure/queues/orchestration-queue.service.js';
import { deriveDeterministicJobId } from '../infrastructure/queues/queue-job-id.js';

describe('OrchestrationQueueService', () => {
  let queueService: OrchestrationQueueService;
  let mockRedis: Partial<Redis>;
  let mockQueue: any;

  beforeEach(() => {
    mockRedis = {};
    mockQueue = {
      name: 'availability-check',
      add: vi.fn().mockImplementation((name, envelope, opts) => ({
        id: opts?.jobId || 'job_1',
      })),
      close: vi.fn().mockResolvedValue(undefined),
    };

    queueService = new OrchestrationQueueService(mockRedis as Redis);
    vi.spyOn(queueService.getFactory(), 'getAvailabilityQueue').mockReturnValue(mockQueue);
    vi.spyOn(queueService.getFactory(), 'getBookingQueue').mockReturnValue(mockQueue);
    vi.spyOn(queueService.getFactory(), 'getResumeQueue').mockReturnValue(mockQueue);
  });

  it('deriveDeterministicJobId creates identical stable SHA-256 IDs for identical idempotency keys', () => {
    const id1 = deriveDeterministicJobId('case_1:cycle_1:avail');
    const id2 = deriveDeterministicJobId('case_1:cycle_1:avail');
    const id3 = deriveDeterministicJobId('case_1:cycle_2:avail');

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1).toHaveLength(64); // SHA-256 hex
  });

  it('enqueues availability-check with deterministic job ID and versioned envelope', async () => {
    const res = await queueService.enqueueAvailabilityCheck({
      caseId: 'case_1',
      correlationId: 'corr_1',
      cycleId: 'cycle_1',
      idempotencyKey: 'case_1:cycle_1:avail',
      payload: {
        applicantCount: 2,
      },
    });

    const expectedJobId = deriveDeterministicJobId('case_1:cycle_1:avail');
    expect(res.jobId).toBe(expectedJobId);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'AVAILABILITY_CHECK',
      expect.objectContaining({
        version: 1,
        jobType: 'AVAILABILITY_CHECK',
        caseId: 'case_1',
        idempotencyKey: 'case_1:cycle_1:avail',
      }),
      { jobId: expectedJobId },
    );
  });
});

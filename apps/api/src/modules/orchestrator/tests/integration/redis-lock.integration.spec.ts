import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createRedisLockClient } from '../../infrastructure/redis/redis-client.factory.js';
import { CaseLockService } from '../../infrastructure/locks/case-lock.service.js';
import { CaseLockConflictError } from '../../infrastructure/locks/case-lock.errors.js';
import type { Redis } from 'ioredis';

describe('Redis Distributed Case Lock Integration Test', () => {
  let redis: Redis;
  let lockService: CaseLockService;
  const testRunId = randomUUID().slice(0, 8);
  const testPrefix = `visaflow:test:${testRunId}`;
  const testCaseId = `case_test_${testRunId}`;

  beforeAll(async () => {
    redis = createRedisLockClient();
    try {
      await redis.connect();
    } catch {
      // already connected or lazy
    }

    lockService = new CaseLockService(redis, {
      ttlMs: 4000,
      heartbeatIntervalMs: 1000,
      keyPrefix: testPrefix,
    });
  });

  afterAll(async () => {
    // Clean up test key safely (no FLUSHDB)
    const key = lockService.formatKey(testCaseId);
    await redis.del(key).catch(() => {});
    await redis.quit().catch(() => {});
  });

  it('Acquire: Worker A successfully acquires lock', async () => {
    const handle = await lockService.acquireLock({
      caseId: testCaseId,
      ownerId: 'worker_A',
      sessionId: 'sess_A',
    });

    expect(handle).toBeDefined();
    expect(handle.caseId).toBe(testCaseId);
    expect(handle.ownerId).toBe('worker_A');

    // Conflict: Worker B cannot acquire the same lock
    await expect(
      lockService.acquireLock({
        caseId: testCaseId,
        ownerId: 'worker_B',
        sessionId: 'sess_B',
      }),
    ).rejects.toThrow(CaseLockConflictError);

    // Wrong owner cannot release Worker A's lock
    const fakeHandle = {
      ...handle,
      token: 'fake_token',
    };
    const releasedFake = await lockService.releaseLock(fakeHandle);
    expect(releasedFake).toBe(false);

    // Worker A safely releases lock
    const releasedA = await lockService.releaseLock(handle);
    expect(releasedA).toBe(true);

    // After release, Worker B can acquire
    const handleB = await lockService.acquireLock({
      caseId: testCaseId,
      ownerId: 'worker_B',
      sessionId: 'sess_B',
    });
    expect(handleB.ownerId).toBe('worker_B');

    await lockService.releaseLock(handleB);
  });

  it('TTL recovery: lock expires automatically when abandoned without heartbeat', async () => {
    const abandonedCaseId = `case_abandoned_${testRunId}`;
    const handle = await lockService.acquireLock({
      caseId: abandonedCaseId,
      ownerId: 'worker_crashed',
      sessionId: 'sess_crashed',
      ttlMs: 500, // Short TTL for test
    });
    expect(handle).toBeDefined();

    // Conflict while active
    await expect(
      lockService.acquireLock({
        caseId: abandonedCaseId,
        ownerId: 'worker_new',
        sessionId: 'sess_new',
      }),
    ).rejects.toThrow(CaseLockConflictError);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Now acquirable
    const newHandle = await lockService.acquireLock({
      caseId: abandonedCaseId,
      ownerId: 'worker_new',
      sessionId: 'sess_new',
    });
    expect(newHandle).toBeDefined();

    await lockService.releaseLock(newHandle);
  });
});

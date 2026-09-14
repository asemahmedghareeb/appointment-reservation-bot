import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { CaseLockService } from '../infrastructure/locks/case-lock.service.js';
import {
  CaseLockConflictError,
  CaseLockOwnershipLostError,
} from '../infrastructure/locks/case-lock.errors.js';

describe('CaseLockService', () => {
  let lockService: CaseLockService;
  let mockRedis: Partial<Redis>;

  beforeEach(() => {
    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn().mockResolvedValue(1),
    };

    lockService = new CaseLockService(mockRedis as Redis, {
      ttlMs: 5000,
      heartbeatIntervalMs: 1000,
    });
  });

  it('formats key exactly as visaflow:case:{caseId}:lock', () => {
    expect(lockService.formatKey('c123')).toBe('visaflow:case:c123:lock');
  });

  it('acquires lock atomically with NX PX and returns handle', async () => {
    const handle = await lockService.acquireLock({
      caseId: 'c123',
      ownerId: 'worker_1',
      sessionId: 'sess_1',
    });

    expect(mockRedis.set).toHaveBeenCalledWith(
      'visaflow:case:c123:lock',
      expect.stringContaining('worker_1:sess_1:'),
      'PX',
      5000,
      'NX',
    );
    expect(handle.caseId).toBe('c123');
    expect(handle.key).toBe('visaflow:case:c123:lock');
  });

  it('throws CaseLockConflictError when lock is already held', async () => {
    vi.spyOn(mockRedis as any, 'set').mockResolvedValue(null as any);

    await expect(
      lockService.acquireLock({
        caseId: 'c123',
        ownerId: 'worker_2',
        sessionId: 'sess_2',
      }),
    ).rejects.toThrow(CaseLockConflictError);
  });

  it('releases lock atomically via Lua script checking ownership token', async () => {
    const handle = await lockService.acquireLock({
      caseId: 'c123',
      ownerId: 'worker_1',
      sessionId: 'sess_1',
    });

    const released = await lockService.releaseLock(handle);
    expect(released).toBe(true);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('DEL'),
      1,
      handle.key,
      handle.token,
    );
  });

  it('renews lock TTL atomically via Lua script checking token', async () => {
    const handle = await lockService.acquireLock({
      caseId: 'c123',
      ownerId: 'worker_1',
      sessionId: 'sess_1',
    });

    const renewed = await lockService.renewLock(handle, 10000);
    expect(renewed).toBe(true);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('PEXPIRE'),
      1,
      handle.key,
      handle.token,
      '10000',
    );
  });

  it('withCaseLock executes action and releases lock in finally block', async () => {
    let executed = false;
    const res = await lockService.withCaseLock(
      { caseId: 'c123', ownerId: 'w1', sessionId: 's1' },
      async (handle) => {
        expect(handle.caseId).toBe('c123');
        executed = true;
        return 'done';
      },
    );

    expect(executed).toBe(true);
    expect(res).toBe('done');
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('DEL'),
      1,
      'visaflow:case:c123:lock',
      expect.any(String),
    );
  });
});

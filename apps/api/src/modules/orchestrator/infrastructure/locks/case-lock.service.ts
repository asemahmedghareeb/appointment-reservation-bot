import { Injectable, Inject, Optional, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS_LOCK_CLIENT } from '../redis/redis.tokens.js';
import type { CaseLockHandle, AcquireLockParams } from './case-lock.types.js';
import { CaseLockConfig, DEFAULT_CASE_LOCK_CONFIG } from './case-lock.config.js';
import { CaseLockConflictError, CaseLockOwnershipLostError } from './case-lock.errors.js';

const RENEW_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
  return 0
end
`;

const RELEASE_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

@Injectable()
export class CaseLockService implements OnModuleDestroy {
  private readonly config: CaseLockConfig;
  private readonly activeHeartbeats = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(REDIS_LOCK_CLIENT) private readonly redis: Redis,
    @Optional() configOverride?: Partial<CaseLockConfig>,
  ) {
    this.config = {
      ...DEFAULT_CASE_LOCK_CONFIG,
      ...configOverride,
    };

    if (this.config.heartbeatIntervalMs >= this.config.ttlMs) {
      throw new Error(
        `CaseLockConfig invalid: heartbeatIntervalMs (${this.config.heartbeatIntervalMs}ms) must be strictly less than ttlMs (${this.config.ttlMs}ms).`,
      );
    }
  }

  formatKey(caseId: string): string {
    if (this.config.keyPrefix) {
      return `${this.config.keyPrefix}:case:${caseId}:lock`;
    }
    return `visaflow:case:${caseId}:lock`;
  }

  async acquireLock(params: AcquireLockParams): Promise<CaseLockHandle> {
    const key = this.formatKey(params.caseId);
    const ttlMs = params.ttlMs ?? this.config.ttlMs;
    const nonce = randomUUID();
    const token = `${params.ownerId}:${params.sessionId}:${nonce}`;

    // Atomic acquisition: SET key token NX PX ttlMs
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');

    if (result !== 'OK') {
      throw new CaseLockConflictError(params.caseId);
    }

    return {
      caseId: params.caseId,
      key,
      ownerId: params.ownerId,
      sessionId: params.sessionId,
      token,
      ttlMs,
    };
  }

  async renewLock(handle: CaseLockHandle, extendTtlMs?: number): Promise<boolean> {
    const ttl = extendTtlMs ?? handle.ttlMs;
    const res = await this.redis.eval(
      RENEW_LOCK_LUA,
      1,
      handle.key,
      handle.token,
      ttl.toString(),
    );

    return res === 1;
  }

  async releaseLock(handle: CaseLockHandle): Promise<boolean> {
    // 1. Stop background heartbeat
    this.stopHeartbeat(handle);

    // 2. Safe Lua release
    const res = await this.redis.eval(
      RELEASE_LOCK_LUA,
      1,
      handle.key,
      handle.token,
    );

    return res === 1;
  }

  startHeartbeat(handle: CaseLockHandle, onOwnershipLost?: () => void): void {
    if (this.activeHeartbeats.has(handle.key)) {
      this.stopHeartbeat(handle);
    }

    const interval = setInterval(async () => {
      try {
        const renewed = await this.renewLock(handle);
        if (!renewed) {
          this.stopHeartbeat(handle);
          if (onOwnershipLost) {
            onOwnershipLost();
          }
        }
      } catch {
        this.stopHeartbeat(handle);
        if (onOwnershipLost) {
          onOwnershipLost();
        }
      }
    }, this.config.heartbeatIntervalMs);

    // Prevent interval from holding process alive if unref is available
    if (typeof interval.unref === 'function') {
      interval.unref();
    }

    this.activeHeartbeats.set(handle.key, interval);
  }

  stopHeartbeat(handle: CaseLockHandle): void {
    const timer = this.activeHeartbeats.get(handle.key);
    if (timer) {
      clearInterval(timer);
      this.activeHeartbeats.delete(handle.key);
    }
  }

  async withCaseLock<T>(
    params: AcquireLockParams,
    fn: (handle: CaseLockHandle) => Promise<T>,
  ): Promise<T> {
    const handle = await this.acquireLock(params);
    let ownershipLost = false;

    this.startHeartbeat(handle, () => {
      ownershipLost = true;
    });

    try {
      const result = await fn(handle);
      if (ownershipLost) {
        throw new CaseLockOwnershipLostError(params.caseId);
      }
      return result;
    } finally {
      await this.releaseLock(handle).catch(() => {
        // ignore release errors in finally if already expired
      });
    }
  }

  onModuleDestroy(): void {
    for (const [, timer] of this.activeHeartbeats) {
      clearInterval(timer);
    }
    this.activeHeartbeats.clear();
  }
}

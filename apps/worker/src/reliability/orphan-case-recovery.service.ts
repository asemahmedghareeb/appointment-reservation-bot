import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { RecoveryCandidate } from '@visaflow/shared-types';
import type { WorkerRepository } from '../repositories/worker.repository.js';
import type { JobRecoveryService, ReconcileResult } from './job-recovery.service.js';
import { SafeLogger } from '../observability/safe-logger.js';

const RELEASE_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

export class OrphanCaseRecoveryService {
  private readonly logger = new SafeLogger('OrphanCaseRecoveryService');

  constructor(
    private readonly redis: Redis,
    private readonly repo: WorkerRepository,
    private readonly jobRecovery: JobRecoveryService,
    private readonly workerId: string,
    private readonly lockPrefix = 'visaflow:case',
  ) {}

  async recoverCandidate(candidate: RecoveryCandidate): Promise<ReconcileResult | null> {
    const lockKey = `${this.lockPrefix}:${candidate.caseId}:lock`;
    const lockToken = `${this.workerId}:orphan-recovery:${randomUUID()}`;
    const lockTtlMs = 30000;

    // 1. Acquire case lock
    const acquired = await this.redis.set(lockKey, lockToken, 'PX', lockTtlMs, 'NX');
    if (acquired !== 'OK') {
      this.logger.warn(
        `Case ${candidate.caseId} is locked by another process; skipping recovery cycle`,
        { caseId: candidate.caseId },
      );
      return null;
    }

    try {
      // 2. Re-read fresh state to verify candidate is still stale
      const freshCase = await this.repo.findCaseById(candidate.caseId);
      if (!freshCase || freshCase.status !== candidate.status) {
        this.logger.info(
          `Case ${candidate.caseId} state has changed; skipping recovery`,
          { caseId: candidate.caseId, originalStatus: candidate.status, freshStatus: freshCase?.status },
        );
        return null;
      }

      // 3. Perform recovery safely
      const result = await this.jobRecovery.reconcileOrphan(candidate);
      this.logger.info(
        `Recovered orphan case ${candidate.caseId}: ${result.details}`,
        { caseId: candidate.caseId, actionTaken: result.actionTaken },
      );
      return result;
    } finally {
      // 4. Release lock safely via Lua
      await this.redis.eval(RELEASE_LOCK_LUA, 1, lockKey, lockToken).catch(() => {});
    }
  }
}

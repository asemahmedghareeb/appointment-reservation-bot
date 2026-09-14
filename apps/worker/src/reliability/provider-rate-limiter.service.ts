import { workerLogger } from '../observability/safe-logger.js';

export interface RateLimiterConfig {
  maxConcurrentSessionsPerAccount: number;
  minimumOperationIntervalMs: number;
  maxGlobalConcurrentSessions: number;
}

export class ProviderRateLimiterService {
  private readonly config: RateLimiterConfig;
  private readonly activeAccountSessions = new Map<string, number>();
  private readonly lastOperationTimestamps = new Map<string, number>();
  private currentGlobalSessions = 0;

  constructor(configOverride?: Partial<RateLimiterConfig>) {
    this.config = {
      maxConcurrentSessionsPerAccount: 1,
      minimumOperationIntervalMs: 5000,
      maxGlobalConcurrentSessions: 5,
      ...configOverride,
    };
  }

  canExecute(providerAccountId: string): { allowed: boolean; reason?: string } {
    if (this.currentGlobalSessions >= this.config.maxGlobalConcurrentSessions) {
      return {
        allowed: false,
        reason: `Global VFS session limit (${this.config.maxGlobalConcurrentSessions}) reached.`,
      };
    }

    const activeForAccount = this.activeAccountSessions.get(providerAccountId) ?? 0;
    if (activeForAccount >= this.config.maxConcurrentSessionsPerAccount) {
      return {
        allowed: false,
        reason: `Account [${providerAccountId}] already has active session running.`,
      };
    }

    const lastTime = this.lastOperationTimestamps.get(providerAccountId) ?? 0;
    const elapsed = Date.now() - lastTime;
    if (elapsed < this.config.minimumOperationIntervalMs) {
      return {
        allowed: false,
        reason: `Rate limit backoff active: ${this.config.minimumOperationIntervalMs - elapsed}ms remaining.`,
      };
    }

    return { allowed: true };
  }

  acquire(providerAccountId: string): void {
    const active = this.activeAccountSessions.get(providerAccountId) ?? 0;
    this.activeAccountSessions.set(providerAccountId, active + 1);
    this.currentGlobalSessions++;
    this.lastOperationTimestamps.set(providerAccountId, Date.now());
    workerLogger.debug(`Acquired rate limit slot for account [${providerAccountId}]. Active global: ${this.currentGlobalSessions}`);
  }

  release(providerAccountId: string): void {
    const active = this.activeAccountSessions.get(providerAccountId) ?? 1;
    if (active <= 1) {
      this.activeAccountSessions.delete(providerAccountId);
    } else {
      this.activeAccountSessions.set(providerAccountId, active - 1);
    }

    if (this.currentGlobalSessions > 0) {
      this.currentGlobalSessions--;
    }
    workerLogger.debug(`Released rate limit slot for account [${providerAccountId}]. Active global: ${this.currentGlobalSessions}`);
  }

  getActiveSessionsCount(): number {
    return this.currentGlobalSessions;
  }
}

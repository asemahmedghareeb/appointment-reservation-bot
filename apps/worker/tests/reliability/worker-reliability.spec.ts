import { describe, it, expect, vi } from 'vitest';
import { GracefulShutdownService } from '../../src/reliability/graceful-shutdown.service.js';
import { ProviderRateLimiterService } from '../../src/reliability/provider-rate-limiter.service.js';

describe('Worker Reliability Services', () => {
  describe('GracefulShutdownService', () => {
    it('executes registered shutdown hooks within deadline', async () => {
      const shutdownService = new GracefulShutdownService(2000);
      const hook1 = vi.fn().mockResolvedValue(undefined);
      const hook2 = vi.fn().mockResolvedValue(undefined);

      shutdownService.register('db-pool', hook1);
      shutdownService.register('browser', hook2);

      await shutdownService.shutdown('SIGTERM');

      expect(hook1).toHaveBeenCalledTimes(1);
      expect(hook2).toHaveBeenCalledTimes(1);
      expect(shutdownService.isInProgress).toBe(true);
    });

    it('does not crash if a hook throws an error', async () => {
      const shutdownService = new GracefulShutdownService(2000);
      const brokenHook = vi.fn().mockRejectedValue(new Error('Connection reset'));
      const goodHook = vi.fn().mockResolvedValue(undefined);

      shutdownService.register('broken', brokenHook);
      shutdownService.register('good', goodHook);

      await shutdownService.shutdown('SIGINT');

      expect(brokenHook).toHaveBeenCalled();
      expect(goodHook).toHaveBeenCalled();
    });
  });

  describe('ProviderRateLimiterService', () => {
    it('enforces single concurrent session per provider account', () => {
      const limiter = new ProviderRateLimiterService({
        maxConcurrentSessionsPerAccount: 1,
        minimumOperationIntervalMs: 0,
        maxGlobalConcurrentSessions: 5,
      });

      const firstCheck = limiter.canExecute('account-1');
      expect(firstCheck.allowed).toBe(true);

      limiter.acquire('account-1');

      const secondCheck = limiter.canExecute('account-1');
      expect(secondCheck.allowed).toBe(false);
      expect(secondCheck.reason).toContain('already has active session');

      limiter.release('account-1');

      const thirdCheck = limiter.canExecute('account-1');
      expect(thirdCheck.allowed).toBe(true);
    });

    it('enforces global session concurrency ceiling', () => {
      const limiter = new ProviderRateLimiterService({
        maxConcurrentSessionsPerAccount: 5,
        minimumOperationIntervalMs: 0,
        maxGlobalConcurrentSessions: 2,
      });

      limiter.acquire('acc-A');
      limiter.acquire('acc-B');

      const thirdCheck = limiter.canExecute('acc-C');
      expect(thirdCheck.allowed).toBe(false);
      expect(thirdCheck.reason).toContain('Global VFS session limit');
    });
  });
});

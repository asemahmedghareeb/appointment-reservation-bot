import { describe, it, expect, vi } from 'vitest';
import { RetryPolicy, OperationClass } from '../../src/reliability/retry-policy.js';

describe('RetryPolicy', () => {
  it('allows retrying transient network errors on read operations', () => {
    const err = new Error('Navigation timeout of 30000ms exceeded');
    expect(RetryPolicy.isRetryable(err, OperationClass.AVAILABILITY)).toBe(true);
    expect(RetryPolicy.isRetryable(err, OperationClass.AUTHENTICATION)).toBe(true);
  });

  it('strictly forbids blind retrying of irreversible booking operations', () => {
    const timeoutErr = new Error('ETIMEDOUT');
    expect(RetryPolicy.isRetryable(timeoutErr, OperationClass.BOOKING)).toBe(false);
    expect(RetryPolicy.isRetryable(timeoutErr, OperationClass.APPLICANT_SUBMISSION)).toBe(false);
    expect(RetryPolicy.isRetryable(timeoutErr, OperationClass.APPOINTMENT_SELECTION)).toBe(false);
    expect(RetryPolicy.isRetryable(timeoutErr, OperationClass.PAYMENT_CONFIRMATION)).toBe(false);
  });

  it('calculates exponential backoff with ceiling', () => {
    const config = {
      maxAttempts: 4,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      isIrreversible: false,
    };

    expect(RetryPolicy.calculateBackoff(1, config)).toBe(0);
    const delay2 = RetryPolicy.calculateBackoff(2, config);
    expect(delay2).toBeGreaterThanOrEqual(1000);
    expect(delay2).toBeLessThanOrEqual(1300);

    const delay5 = RetryPolicy.calculateBackoff(5, config);
    expect(delay5).toBe(5000); // capped at maxDelayMs
  });

  it('executes retries and succeeds when transient error clears', async () => {
    let callCount = 0;
    const mockOp = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error('Navigation timeout');
      }
      return 'SUCCESS';
    });

    const result = await RetryPolicy.execute(mockOp, OperationClass.AVAILABILITY, {
      baseDelayMs: 10,
      maxDelayMs: 50,
      maxAttempts: 3,
    });

    expect(result).toBe('SUCCESS');
    expect(callCount).toBe(2);
  });
});

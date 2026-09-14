import { ErrorClassification } from '@visaflow/shared-types';
import { VfsErrorClassifier } from '@visaflow/vfs-adapter';

export enum OperationClass {
  AUTHENTICATION = 'AUTHENTICATION',
  AVAILABILITY = 'AVAILABILITY',
  BOOKING = 'BOOKING',
  APPLICANT_SUBMISSION = 'APPLICANT_SUBMISSION',
  APPOINTMENT_SELECTION = 'APPOINTMENT_SELECTION',
  PAYMENT_STATUS = 'PAYMENT_STATUS',
  PAYMENT_CONFIRMATION = 'PAYMENT_CONFIRMATION',
  SESSION_RESUME = 'SESSION_RESUME',
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  isIrreversible: boolean;
}

export const DEFAULT_RETRY_CONFIGS: Record<OperationClass, RetryConfig> = {
  [OperationClass.AUTHENTICATION]: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 8000,
    isIrreversible: false,
  },
  [OperationClass.AVAILABILITY]: {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 10000,
    isIrreversible: false,
  },
  [OperationClass.BOOKING]: {
    maxAttempts: 1, // Irreversible - NEVER blindly retry
    baseDelayMs: 0,
    maxDelayMs: 0,
    isIrreversible: true,
  },
  [OperationClass.APPLICANT_SUBMISSION]: {
    maxAttempts: 1, // Irreversible - NEVER blindly retry
    baseDelayMs: 0,
    maxDelayMs: 0,
    isIrreversible: true,
  },
  [OperationClass.APPOINTMENT_SELECTION]: {
    maxAttempts: 1, // Irreversible - NEVER blindly retry
    baseDelayMs: 0,
    maxDelayMs: 0,
    isIrreversible: true,
  },
  [OperationClass.PAYMENT_CONFIRMATION]: {
    maxAttempts: 1, // Irreversible - NEVER blindly retry
    baseDelayMs: 0,
    maxDelayMs: 0,
    isIrreversible: true,
  },
  [OperationClass.PAYMENT_STATUS]: {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 8000,
    isIrreversible: false,
  },
  [OperationClass.SESSION_RESUME]: {
    maxAttempts: 2,
    baseDelayMs: 1500,
    maxDelayMs: 5000,
    isIrreversible: false,
  },
};

export class RetryPolicy {
  static calculateBackoff(attempt: number, config: RetryConfig): number {
    if (attempt <= 1 || config.maxAttempts <= 1) return 0;
    const exponential = config.baseDelayMs * Math.pow(2, attempt - 2);
    // Bounded jitter between 0ms and 30% of base delay
    const jitter = Math.floor(Math.random() * (config.baseDelayMs * 0.3));
    return Math.min(exponential + jitter, config.maxDelayMs);
  }

  static isRetryable(error: unknown, opClass: OperationClass): boolean {
    const config = DEFAULT_RETRY_CONFIGS[opClass];
    if (config.isIrreversible) {
      return false; // Principle: Stop + Require Review, never blindly retry irreversible operations
    }

    const classified = VfsErrorClassifier.classify(error, config.isIrreversible);
    return (
      classified.isRetryable &&
      (classified.classification === ErrorClassification.TRANSIENT ||
        classified.classification === ErrorClassification.INFRASTRUCTURE)
    );
  }

  static async execute<T>(
    operation: () => Promise<T>,
    opClass: OperationClass,
    customConfig?: Partial<RetryConfig>,
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void,
  ): Promise<T> {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIGS[opClass],
      ...customConfig,
    };

    let attempt = 1;
    while (attempt <= config.maxAttempts) {
      try {
        return await operation();
      } catch (err) {
        const canRetry = attempt < config.maxAttempts && this.isRetryable(err, opClass);

        if (!canRetry) {
          throw err;
        }

        const delay = this.calculateBackoff(attempt + 1, config);
        if (onRetry) {
          onRetry(attempt, err, delay);
        }

        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        attempt++;
      }
    }

    throw new Error(`Max retry attempts (${config.maxAttempts}) reached for ${opClass}`);
  }
}

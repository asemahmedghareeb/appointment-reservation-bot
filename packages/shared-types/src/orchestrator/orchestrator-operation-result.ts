import type { BookingCaseStatus } from '../enums/booking-case-status.enum.js';

export type IdempotencyOutcome =
  | {
      outcome: 'EXECUTE';
    }
  | {
      outcome: 'SKIPPED_ALREADY_APPLIED';
      currentStatus: BookingCaseStatus;
    }
  | {
      outcome: 'SKIPPED_STALE';
      currentStatus: BookingCaseStatus;
    };

export type OrchestrationExecutionOutcome =
  | 'PENDING_NO_SLOT'
  | 'GROUP_CAPACITY_MISMATCH'
  | 'HUMAN_ACTION_REQUIRED'
  | 'SLOT_FOUND'
  | 'SLOT_LOST'
  | 'PAYMENT_REQUIRED'
  | 'CONFIRMED'
  | 'RETRYABLE_FAILURE'
  | 'FAILED'
  | 'SKIPPED_STALE'
  | 'SKIPPED_ALREADY_APPLIED';

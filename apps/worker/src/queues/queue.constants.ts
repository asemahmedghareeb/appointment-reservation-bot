import { createHash } from 'node:crypto';

export const QUEUE_NAMES = {
  AVAILABILITY_CHECK: 'availability-check',
  BOOKING_EXECUTION: 'booking-execution',
  SESSION_RESUME: 'session-resume',
} as const;

export const DEFAULT_QUEUE_PREFIX = 'visaflow';

export function deriveDeterministicJobId(idempotencyKey: string): string {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new Error('idempotencyKey must be a non-empty string');
  }
  return createHash('sha256').update(idempotencyKey, 'utf8').digest('hex');
}

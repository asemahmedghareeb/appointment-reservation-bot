import { createHash } from 'node:crypto';

export function deriveDeterministicJobId(idempotencyKey: string): string {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new Error('idempotencyKey must be a non-empty string');
  }

  // Derive stable hex token from SHA-256
  return createHash('sha256').update(idempotencyKey, 'utf8').digest('hex');
}

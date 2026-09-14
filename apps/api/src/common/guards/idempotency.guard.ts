/**
 * Idempotency key guard for double-click protection on sensitive mutating endpoints.
 *
 * When an `X-Idempotency-Key` header is present, this guard tracks whether the request
 * has already been processed using a Map<string, Date>. Duplicate keys within the TTL
 * window return a 409 Conflict instead of repeating the operation.
 *
 * This is a lightweight, in-process guard designed for low-throughput automation start
 * and resume endpoints. In a multi-instance deployment, a Redis-backed implementation
 * should replace this.
 */
import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  ConflictException,
} from '@nestjs/common';
import type { Request } from 'express';

const IDEMPOTENCY_KEY_TTL_MS = 60 * 1000; // 1 minute
const IDEMPOTENCY_HEADER = 'x-idempotency-key';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  private readonly processedKeys = new Map<string, Date>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers[IDEMPOTENCY_HEADER];

    if (!key || typeof key !== 'string') {
      return true; // No key provided — pass through
    }

    const now = new Date();
    this.evictStale(now);

    if (this.processedKeys.has(key)) {
      throw new ConflictException(
        `This request has already been processed. Idempotency key: ${key}`,
      );
    }

    // Mark as processed immediately before execution
    this.processedKeys.set(key, now);
    return true;
  }

  private evictStale(now: Date): void {
    for (const [key, ts] of this.processedKeys) {
      if (now.getTime() - ts.getTime() > IDEMPOTENCY_KEY_TTL_MS) {
        this.processedKeys.delete(key);
      }
    }
  }
}

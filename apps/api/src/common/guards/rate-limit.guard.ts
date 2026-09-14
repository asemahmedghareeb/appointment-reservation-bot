/**
 * In-process per-route rate limiter guard.
 *
 * Provides basic per-IP rate limiting for sensitive automation endpoints.
 * Each bucket tracks request timestamps within the window. Requests exceeding
 * `limit` within `windowMs` receive a 429 TooManyRequests.
 *
 * For multi-instance deployments, replace with Redis-backed sliding window.
 */
import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly options: RateLimitOptions) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = (req.ip ?? req.socket?.remoteAddress ?? 'unknown').replace(/::ffff:/, '');
    const now = Date.now();

    if (!this.buckets.has(ip)) {
      this.buckets.set(ip, []);
    }

    const timestamps = this.buckets.get(ip)!;

    // Evict timestamps outside window
    const windowStart = now - this.options.windowMs;
    const recent = timestamps.filter((t) => t > windowStart);
    this.buckets.set(ip, recent);

    if (recent.length >= this.options.limit) {
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Max ${this.options.limit} requests per ${this.options.windowMs / 1000}s.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    return true;
  }
}

export function createRateLimitGuard(options: RateLimitOptions): RateLimitGuard {
  return new RateLimitGuard(options);
}

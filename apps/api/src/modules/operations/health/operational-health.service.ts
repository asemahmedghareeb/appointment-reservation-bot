import { Injectable, Inject, Optional } from '@nestjs/common';
import { prisma } from '@visaflow/database';
import { Redis } from 'ioredis';
import { REDIS_LOCK_CLIENT } from '../../orchestrator/infrastructure/redis/redis.tokens.js';

export interface ReadinessCheckResult {
  status: 'UP' | 'DOWN';
  details?: string;
}

export interface SystemReadinessReport {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  timestamp: string;
  checks: {
    database: ReadinessCheckResult;
    redis: ReadinessCheckResult;
  };
}

@Injectable()
export class OperationalHealthService {
  constructor(
    @Optional() @Inject(REDIS_LOCK_CLIENT) private readonly redisClient?: Redis,
  ) {}

  getLiveness(): { status: 'UP'; timestamp: string; uptime: number } {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async getReadiness(): Promise<SystemReadinessReport> {
    const dbResult = await this.checkDatabase();
    const redisResult = await this.checkRedis();

    const allUp = dbResult.status === 'UP' && redisResult.status === 'UP';
    const anyDown = dbResult.status === 'DOWN' || redisResult.status === 'DOWN';

    return {
      status: allUp ? 'UP' : anyDown ? 'DOWN' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbResult,
        redis: redisResult,
      },
    };
  }

  private async checkDatabase(): Promise<ReadinessCheckResult> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'UP' };
    } catch (err: any) {
      return {
        status: 'DOWN',
        details: err?.message ? 'Database query failed' : 'Unknown database error',
      };
    }
  }

  private async checkRedis(): Promise<ReadinessCheckResult> {
    if (!this.redisClient) {
      return { status: 'DOWN', details: 'Redis client not configured' };
    }
    try {
      const pong = await this.redisClient.ping();
      if (pong === 'PONG') {
        return { status: 'UP' };
      }
      return { status: 'DOWN', details: 'Unexpected Redis ping response' };
    } catch (err: any) {
      return {
        status: 'DOWN',
        details: 'Redis connection unreachable',
      };
    }
  }
}

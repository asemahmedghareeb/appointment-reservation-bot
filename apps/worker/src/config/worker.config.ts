import { getEnv } from '@visaflow/config';
import { randomUUID } from 'node:crypto';
import type { RedisOptions } from 'ioredis';

export interface WorkerConfig {
  workerId: string;
  redisUrl: string;
  queuePrefix: string;
  vfsHeadless: boolean;
  vfsNavTimeoutMs: number;
  vfsActionTimeoutMs: number;
  vfsAllowedOrigins: string[];
  sessionTtlMinutes: number;
}

export function loadWorkerConfig(): WorkerConfig {
  const env = getEnv();
  const workerId = env.WORKER_ID || `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

  const allowedOrigins = env.VFS_ALLOWED_ORIGINS
    ? env.VFS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['https://visa.vfsglobal.com'];

  return {
    workerId,
    redisUrl: env.REDIS_URL,
    queuePrefix: 'visaflow',
    vfsHeadless: env.VFS_HEADLESS ?? true,
    vfsNavTimeoutMs: env.VFS_NAVIGATION_TIMEOUT_MS ?? 30000,
    vfsActionTimeoutMs: env.VFS_ACTION_TIMEOUT_MS ?? 15000,
    vfsAllowedOrigins: allowedOrigins,
    sessionTtlMinutes: env.AUTOMATION_SESSION_TTL_MINUTES ?? 30,
  };


}

export function getRedisOptions(redisUrl: string): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  };
}

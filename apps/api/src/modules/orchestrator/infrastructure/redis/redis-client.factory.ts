import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import { Redis, type RedisOptions } from 'ioredis';
import { getEnv } from '@visaflow/config';

function ensureEnvLoaded(): void {
  if (!process.env.REDIS_URL) {
    let dir = process.cwd();
    for (let i = 0; i < 3; i++) {
      const envPath = resolve(dir, '.env');
      if (existsSync(envPath)) {
        loadDotenv({ path: envPath });
        break;
      }
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  }
}

export function getRedisOptions(urlOverride?: string): { url: string; options: RedisOptions } {
  ensureEnvLoaded();
  let redisUrl = urlOverride || process.env.REDIS_URL;
  if (!redisUrl) {
    try {
      redisUrl = getEnv().REDIS_URL;
    } catch {
      redisUrl = 'redis://localhost:6379';
    }
  }

  const isTls = redisUrl.startsWith('rediss://');
  const options: RedisOptions = {
    lazyConnect: true,
    connectTimeout: 10_000,
    tls: isTls ? {} : undefined,
    retryStrategy: (times) => {
      if (times > 5) return null;
      return Math.min(times * 500, 2000);
    },
  };

  return { url: redisUrl, options };
}

export function createRedisLockClient(urlOverride?: string): Redis {
  const { url, options } = getRedisOptions(urlOverride);
  return new Redis(url, {
    ...options,
    maxRetriesPerRequest: 3,
  });
}

export function createRedisQueueClient(urlOverride?: string): Redis {
  const { url, options } = getRedisOptions(urlOverride);
  return new Redis(url, {
    ...options,
    // BullMQ requires maxRetriesPerRequest to be null
    maxRetriesPerRequest: null,
  });
}

export function createRedisClient(urlOverride?: string): Redis {
  const { url, options } = getRedisOptions(urlOverride);
  return new Redis(url, options);
}

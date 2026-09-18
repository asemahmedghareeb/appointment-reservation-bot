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
  workerShutdownTimeoutMs?: number;
  productionSafeMode?: boolean;
  liveVisualMonitorEnabled?: boolean;
  liveVisualMonitorJpegQuality?: number;
  liveVisualMonitorMaxWidth?: number;
  liveVisualMonitorMaxHeight?: number;
  liveVisualMonitorEveryNthFrame?: number;
  vfsProxyServer?: string;
  vfsProxyUsername?: string;
  vfsProxyPassword?: string;
  vfsProxyBypass?: string;
  vfsUseCdp?: boolean | undefined;
  vfsCdpPort?: number | undefined;
  vfsCdpUrl?: string | undefined;
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
    workerShutdownTimeoutMs: 10000,
    productionSafeMode: process.env.PRODUCTION_SAFE_MODE === 'true',
    liveVisualMonitorEnabled: process.env.LIVE_VISUAL_MONITOR_ENABLED !== 'false',
    liveVisualMonitorJpegQuality: Number(process.env.LIVE_VISUAL_MONITOR_JPEG_QUALITY) || 50,
    liveVisualMonitorMaxWidth: Number(process.env.LIVE_VISUAL_MONITOR_MAX_WIDTH) || 960,
    liveVisualMonitorMaxHeight: Number(process.env.LIVE_VISUAL_MONITOR_MAX_HEIGHT) || 600,
    liveVisualMonitorEveryNthFrame: Number(process.env.LIVE_VISUAL_MONITOR_EVERY_NTH_FRAME) || 2,
    vfsUseCdp: process.env.VFS_USE_CDP !== 'false',
    vfsCdpPort: Number(process.env.VFS_CDP_PORT) || 9222,
    vfsCdpUrl: process.env.VFS_CDP_URL,
    ...(process.env.VFS_PROXY_SERVER ? { vfsProxyServer: process.env.VFS_PROXY_SERVER } : {}),
    ...(process.env.VFS_PROXY_USERNAME ? { vfsProxyUsername: process.env.VFS_PROXY_USERNAME } : {}),
    ...(process.env.VFS_PROXY_PASSWORD ? { vfsProxyPassword: process.env.VFS_PROXY_PASSWORD } : {}),
    ...(process.env.VFS_PROXY_BYPASS ? { vfsProxyBypass: process.env.VFS_PROXY_BYPASS } : {}),
  };
}

export function getRedisOptions(redisUrl: string): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 20000,
    keepAlive: 30000,
    family: 4,
    retryStrategy: (times) => Math.min(times * 500, 3000),
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'Connection is closed'];
      return targetErrors.some((t) => err.message.includes(t));
    },
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  };
}

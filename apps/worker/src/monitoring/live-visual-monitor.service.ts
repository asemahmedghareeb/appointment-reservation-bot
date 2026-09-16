import { Redis } from 'ioredis';
import type { CDPSession, VfsBrowserSessionManager } from '@visaflow/vfs-adapter';
import type { WorkerConfig } from '../config/worker.config.js';
import { getRedisOptions } from '../config/worker.config.js';
import { workerLogger } from '../observability/safe-logger.js';

export interface LiveSignalPayload {
  type: 'START_VIEWING' | 'STOP_VIEWING' | 'HEARTBEAT';
  caseId: string;
}

export interface LiveFramePayload {
  caseId: string;
  timestamp: string;
  mimeType: string;
  frame?: string;
  visualStatus: 'LIVE' | 'OFFLINE' | 'STALE';
}

interface ActiveScreencast {
  caseId: string;
  cdp: CDPSession;
  viewerCount: number;
  lastHeartbeat: number;
}

export class LiveVisualMonitorService {
  private subscriberClient?: Redis;
  private publisherClient?: Redis;
  private readonly activeScreencasts = new Map<string, ActiveScreencast>();
  private heartbeatInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    private readonly config: WorkerConfig,
    private readonly sessionManager: VfsBrowserSessionManager,
  ) {}

  async start(): Promise<void> {
    if (this.config.liveVisualMonitorEnabled === false) {
      workerLogger.info('Live visual monitor is disabled by configuration.');
      return;
    }

    try {
      this.subscriberClient = new Redis(
        this.config.redisUrl,
        getRedisOptions(this.config.redisUrl),
      );
      this.publisherClient = new Redis(
        this.config.redisUrl,
        getRedisOptions(this.config.redisUrl),
      );

      this.subscriberClient.on('pmessage', (_pattern, channel, message) => {
        try {
          const payload = JSON.parse(message) as LiveSignalPayload;
          const caseId = payload.caseId || channel.slice('visaflow:live-signals:'.length);
          if (!caseId) return;

          this.handleSignal(payload.type, caseId).catch((err) => {
            workerLogger.warn(
              `[LiveVisualMonitor] Error handling signal ${payload.type} for case ${caseId}: ${err.message}`,
            );
          });
        } catch (err: any) {
          workerLogger.warn(`[LiveVisualMonitor] Failed parsing signal message: ${err.message}`);
        }
      });

      // Subscribe to all live viewer signals
      await this.subscriberClient.psubscribe('visaflow:live-signals:*');

      // Cleanup stale screencasts where viewers disappeared without sending STOP_VIEWING
      this.heartbeatInterval = setInterval(() => {
        this.pruneStaleScreencasts();
      }, 10000);

      this.isRunning = true;
      workerLogger.info('LiveVisualMonitorService active and listening for viewer signals.');
    } catch (err: any) {
      workerLogger.warn(`[LiveVisualMonitor] Initialization error: ${err.message}. Automation continues.`);
    }
  }

  async handleSignal(type: 'START_VIEWING' | 'STOP_VIEWING' | 'HEARTBEAT', caseId: string): Promise<void> {
    if (!caseId) return;

    try {
      if (type === 'START_VIEWING') {
        await this.handleStartViewing(caseId);
      } else if (type === 'HEARTBEAT') {
        this.handleHeartbeat(caseId);
      } else if (type === 'STOP_VIEWING') {
        await this.handleStopViewing(caseId);
      }
    } catch (err: any) {
      workerLogger.warn(`[LiveVisualMonitor] Signal handling error for ${caseId}: ${err.message}`);
    }
  }

  private async handleStartViewing(caseId: string): Promise<void> {
    const existing = this.activeScreencasts.get(caseId);
    if (existing) {
      existing.viewerCount++;
      existing.lastHeartbeat = Date.now();
      return;
    }

    const session = this.sessionManager.getSession(caseId);
    if (!session || !session.page || session.page.isClosed()) {
      // No active page found, notify viewer that visual monitor is OFFLINE
      this.publishOfflineStatus(caseId);
      return;
    }

    try {
      const page = session.page;
      const cdp = await page.context().newCDPSession(page);

      await cdp.send('Page.enable');
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: this.config.liveVisualMonitorJpegQuality ?? 50,
        maxWidth: this.config.liveVisualMonitorMaxWidth ?? 960,
        maxHeight: this.config.liveVisualMonitorMaxHeight ?? 600,
        everyNthFrame: this.config.liveVisualMonitorEveryNthFrame ?? 2,
      });

      const handle: ActiveScreencast = {
        caseId,
        cdp,
        viewerCount: 1,
        lastHeartbeat: Date.now(),
      };

      cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
        // 1. Immediately acknowledge the frame to unblock Chromium compositor
        try {
          await cdp.send('Page.screencastFrameAck', { sessionId });
        } catch {
          // Session may be closing
        }

        // 2. Asynchronously publish frame to Redis
        this.publishFrame(caseId, data);
      });

      this.activeScreencasts.set(caseId, handle);
      workerLogger.info(`[LiveVisualMonitor] Started screencast for case ${caseId}`);
    } catch (err: any) {
      workerLogger.warn(`[LiveVisualMonitor] Failed starting screencast for case ${caseId}: ${err.message}`);
      this.publishOfflineStatus(caseId);
    }
  }

  private handleHeartbeat(caseId: string): void {
    const existing = this.activeScreencasts.get(caseId);
    if (existing) {
      existing.lastHeartbeat = Date.now();
    }
  }

  private async handleStopViewing(caseId: string): Promise<void> {
    const existing = this.activeScreencasts.get(caseId);
    if (!existing) return;

    existing.viewerCount = Math.max(0, existing.viewerCount - 1);
    if (existing.viewerCount <= 0) {
      await this.stopScreencast(caseId);
    }
  }

  private async stopScreencast(caseId: string): Promise<void> {
    const handle = this.activeScreencasts.get(caseId);
    if (!handle) return;

    this.activeScreencasts.delete(caseId);

    try {
      await handle.cdp.send('Page.stopScreencast').catch(() => {});
      await handle.cdp.detach().catch(() => {});
      workerLogger.info(`[LiveVisualMonitor] Stopped screencast for case ${caseId}`);
    } catch (err: any) {
      workerLogger.warn(`[LiveVisualMonitor] Error stopping screencast for ${caseId}: ${err.message}`);
    }
  }

  private pruneStaleScreencasts(): void {
    const now = Date.now();
    for (const [caseId, handle] of this.activeScreencasts.entries()) {
      // If no heartbeat for > 25 seconds, prune
      if (now - handle.lastHeartbeat > 25000) {
        workerLogger.info(`[LiveVisualMonitor] Pruning stale screencast for case ${caseId} (no viewer heartbeat)`);
        this.stopScreencast(caseId).catch(() => {});
      }
    }
  }

  private publishFrame(caseId: string, base64Frame: string): void {
    if (!this.publisherClient) return;

    try {
      const payload: LiveFramePayload = {
        caseId,
        timestamp: new Date().toISOString(),
        mimeType: 'image/jpeg',
        frame: base64Frame,
        visualStatus: 'LIVE',
      };

      this.publisherClient
        .publish(`visaflow:live-frames:${caseId}`, JSON.stringify(payload))
        .catch((err) => {
          workerLogger.warn(`[LiveVisualMonitor] Redis publish frame error: ${err.message}`);
        });
    } catch {
      // Fire-and-forget: never throw
    }
  }

  private publishOfflineStatus(caseId: string): void {
    if (!this.publisherClient) return;

    try {
      const payload: LiveFramePayload = {
        caseId,
        timestamp: new Date().toISOString(),
        mimeType: 'image/jpeg',
        visualStatus: 'OFFLINE',
      };

      this.publisherClient
        .publish(`visaflow:live-frames:${caseId}`, JSON.stringify(payload))
        .catch(() => {});
    } catch {
      // Fire-and-forget
    }
  }

  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Stop all active screencasts safely
    const stopPromises = Array.from(this.activeScreencasts.keys()).map((caseId) =>
      this.stopScreencast(caseId),
    );
    await Promise.allSettled(stopPromises);

    try {
      await this.subscriberClient?.quit();
      await this.publisherClient?.quit();
    } catch {
      // Ignore disconnect errors
    }

    this.isRunning = false;
  }

  // Accessors for testing
  getActiveScreencastCount(): number {
    return this.activeScreencasts.size;
  }

  isCaseScreencasting(caseId: string): boolean {
    return this.activeScreencasts.has(caseId);
  }
}

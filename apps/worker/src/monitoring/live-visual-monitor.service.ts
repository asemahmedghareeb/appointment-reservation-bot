import { Redis } from 'ioredis';
import type { CDPSession, VfsBrowserSession, VfsBrowserSessionManager } from '@visaflow/vfs-adapter';
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
  lastFrame?: string;
  lastFrameSentAt?: number;
}

export class LiveVisualMonitorService {
  private subscriberClient?: Redis;
  private publisherClient?: Redis;
  private readonly activeScreencasts = new Map<string, ActiveScreencast>();
  private readonly pendingViewers = new Map<string, number>(); // caseId -> lastViewerSignalAt
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
      this.subscriberClient.on('error', (err) => {
        workerLogger.warn(`[LiveVisualMonitor Redis Subscriber] ${err.message}`);
      });

      this.publisherClient = new Redis(
        this.config.redisUrl,
        getRedisOptions(this.config.redisUrl),
      );
      this.publisherClient.on('error', (err) => {
        workerLogger.warn(`[LiveVisualMonitor Redis Publisher] ${err.message}`);
      });


      // Hook sessionManager lifecycle: if a viewer was waiting for a session, start screencast immediately!
      this.sessionManager.onSessionCreated = (caseId, session) => {
        if (this.pendingViewers.has(caseId)) {
          this.pendingViewers.delete(caseId);
          this.startScreencastForSession(caseId, session).catch((err) => {
            workerLogger.warn(`[LiveVisualMonitor] Error auto-starting screencast for ${caseId}: ${err.message}`);
          });
        }
      };

      this.sessionManager.onSessionClosed = (caseId) => {
        this.pendingViewers.delete(caseId);
        this.stopScreencast(caseId).catch(() => {});
        this.publishOfflineStatus(caseId);
      };

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

      // Periodic check: cleanup stale viewers AND push keep-alive frames for static pages
      this.heartbeatInterval = setInterval(() => {
        this.pruneStaleScreencasts();
      }, 2500);

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
      // Immediately push cached frame so viewer gets instant display without waiting for repaint
      if (existing.lastFrame) {
        this.publishFrame(caseId, existing.lastFrame);
      }
      return;
    }

    const session = this.sessionManager.getSession(caseId);
    if (!session || !session.page || session.page.isClosed()) {
      // Record as pending viewer so when the worker starts the session, screencast attaches immediately
      this.pendingViewers.set(caseId, Date.now());
      return;
    }

    await this.startScreencastForSession(caseId, session);
  }

  private async startScreencastForSession(caseId: string, session: VfsBrowserSession): Promise<void> {
    if (this.activeScreencasts.has(caseId)) {
      return;
    }

    const page = session.page;
    if (!page || page.isClosed()) {
      return;
    }

    try {
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
        lastFrameSentAt: Date.now(),
      };

      // Immediately take a snapshot so viewers don't have to wait for Chromium compositor repaint
      const initialScreenshot = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: this.config.liveVisualMonitorJpegQuality ?? 50,
      }).catch(() => null);

      if (initialScreenshot?.data) {
        handle.lastFrame = initialScreenshot.data;
        handle.lastFrameSentAt = Date.now();
        this.publishFrame(caseId, initialScreenshot.data);
      }

      // Immediately handle page closure to unhook and emit OFFLINE
      page.once?.('close', () => {
        this.stopScreencast(caseId).catch(() => {});
        this.publishOfflineStatus(caseId);
      });

      cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
        // 1. Immediately acknowledge the frame to unblock Chromium compositor
        try {
          await cdp.send('Page.screencastFrameAck', { sessionId });
        } catch {
          // Session may be closing
        }

        handle.lastFrame = data;
        handle.lastFrameSentAt = Date.now();

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
    } else {
      if (this.pendingViewers.has(caseId)) {
        this.pendingViewers.set(caseId, Date.now());
      }
      const session = this.sessionManager.getSession(caseId);
      if (session && session.page && !session.page.isClosed()) {
        this.pendingViewers.delete(caseId);
        this.startScreencastForSession(caseId, session).catch(() => {});
      }
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
        continue;
      }

      // Static page keep-alive: if viewers are active and no frame was sent for > 2.5s, re-publish lastFrame
      if (handle.viewerCount > 0 && handle.lastFrame && (now - (handle.lastFrameSentAt ?? 0) > 2500)) {
        handle.lastFrameSentAt = now;
        this.publishFrame(caseId, handle.lastFrame);
      }
    }
    // Prune pending viewers older than 30s
    for (const [caseId, ts] of this.pendingViewers.entries()) {
      if (now - ts > 30000) {
        this.pendingViewers.delete(caseId);
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

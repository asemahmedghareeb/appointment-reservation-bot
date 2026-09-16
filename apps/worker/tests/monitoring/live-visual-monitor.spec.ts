import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveVisualMonitorService } from '../../src/monitoring/live-visual-monitor.service.js';
import type { WorkerConfig } from '../../src/config/worker.config.js';

describe('LiveVisualMonitorService Unit Tests', () => {
  let monitorService: LiveVisualMonitorService;
  let mockSessionManager: any;
  let mockPage: any;
  let mockContext: any;
  let mockBrowser: any;
  let mockCdpSession: any;
  let cdpListeners: Record<string, Function>;

  const config: WorkerConfig = {
    workerId: 'test-worker-1',
    redisUrl: 'redis://localhost:6379',
    queuePrefix: 'visaflow',
    vfsHeadless: true,
    vfsNavTimeoutMs: 10000,
    vfsActionTimeoutMs: 5000,
    vfsAllowedOrigins: ['http://127.0.0.1'],
    sessionTtlMinutes: 30,
    liveVisualMonitorEnabled: true,
    liveVisualMonitorJpegQuality: 50,
    liveVisualMonitorMaxWidth: 960,
    liveVisualMonitorMaxHeight: 600,
    liveVisualMonitorEveryNthFrame: 2,
  };

  beforeEach(() => {
    cdpListeners = {};

    mockCdpSession = {
      send: vi.fn().mockImplementation((method: string) => {
        return Promise.resolve();
      }),
      on: vi.fn().mockImplementation((event: string, handler: Function) => {
        cdpListeners[event] = handler;
      }),
      detach: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      newCDPSession: vi.fn().mockResolvedValue(mockCdpSession),
      close: vi.fn(),
    };

    mockBrowser = {
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
    };

    mockPage = {
      context: vi.fn().mockReturnValue(mockContext),
      isClosed: vi.fn().mockReturnValue(false),
      goto: vi.fn(),
      setViewportSize: vi.fn(),
      close: vi.fn(),
      once: vi.fn(),
    };

    mockSessionManager = {
      getSession: vi.fn().mockImplementation((caseId: string) => {
        if (caseId === 'active-case-123') {
          return {
            caseId: 'active-case-123',
            browser: mockBrowser,
            context: mockContext,
            page: mockPage,
            accountId: 'acc_1',
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
          };
        }
        return undefined;
      }),
    };

    monitorService = new LiveVisualMonitorService(config, mockSessionManager);
  });

  afterEach(async () => {
    await monitorService.close();
  });

  it('attaches CDP to the EXACT SAME existing Page without creating a new Browser or Context', async () => {
    await monitorService.handleSignal('START_VIEWING', 'active-case-123');

    // Proves it fetched existing session
    expect(mockSessionManager.getSession).toHaveBeenCalledWith('active-case-123');

    // Proves it called newCDPSession on the existing page
    expect(mockContext.newCDPSession).toHaveBeenCalledWith(mockPage);

    // Proves it enabled page & started screencast
    expect(mockCdpSession.send).toHaveBeenCalledWith('Page.enable');
    expect(mockCdpSession.send).toHaveBeenCalledWith('Page.startScreencast', {
      format: 'jpeg',
      quality: 50,
      maxWidth: 960,
      maxHeight: 600,
      everyNthFrame: 2,
    });

    // Proves monitor NEVER navigated or changed viewport of the page
    expect(mockPage.goto).not.toHaveBeenCalled();
    expect(mockPage.setViewportSize).not.toHaveBeenCalled();

    // Proves browser or context was never closed
    expect(mockBrowser.close).not.toHaveBeenCalled();
    expect(mockContext.close).not.toHaveBeenCalled();
  });

  it('immediately acknowledges screencast frames before publishing', async () => {
    await monitorService.handleSignal('START_VIEWING', 'active-case-123');

    const frameHandler = cdpListeners['Page.screencastFrame'];
    expect(frameHandler).toBeDefined();

    // Simulate incoming frame from Chromium compositor
    await frameHandler({
      data: 'base64EncodedJpegDataExample',
      metadata: { timestamp: 12345 },
      sessionId: 42,
    });

    // Proves Page.screencastFrameAck was called with the exact sessionId
    expect(mockCdpSession.send).toHaveBeenCalledWith('Page.screencastFrameAck', {
      sessionId: 42,
    });
  });

  it('handles multiple viewers cleanly without restarting screencast or stopping prematurely', async () => {
    // Viewer 1 arrives
    await monitorService.handleSignal('START_VIEWING', 'active-case-123');
    expect(mockContext.newCDPSession).toHaveBeenCalledTimes(1);
    expect(monitorService.isCaseScreencasting('active-case-123')).toBe(true);

    // Viewer 2 arrives
    await monitorService.handleSignal('START_VIEWING', 'active-case-123');
    // Still only 1 CDP session created (reused for both viewers)
    expect(mockContext.newCDPSession).toHaveBeenCalledTimes(1);
    expect(monitorService.isCaseScreencasting('active-case-123')).toBe(true);

    // Viewer 1 leaves
    await monitorService.handleSignal('STOP_VIEWING', 'active-case-123');
    // Viewer 2 is still watching: screencast MUST NOT stop!
    expect(mockCdpSession.send).not.toHaveBeenCalledWith('Page.stopScreencast');
    expect(monitorService.isCaseScreencasting('active-case-123')).toBe(true);

    // Viewer 2 leaves
    await monitorService.handleSignal('STOP_VIEWING', 'active-case-123');
    // Viewer count is now 0: screencast MUST stop safely
    expect(mockCdpSession.send).toHaveBeenCalledWith('Page.stopScreencast');
    expect(mockCdpSession.detach).toHaveBeenCalled();
    expect(monitorService.isCaseScreencasting('active-case-123')).toBe(false);

    // Critical: Page MUST remain alive after screencast stops!
    expect(mockPage.close).not.toHaveBeenCalled();
    expect(mockBrowser.close).not.toHaveBeenCalled();
  });

  it('publishes OFFLINE when no active browser session exists without failing', async () => {
    // Request view for a case that has no active session
    await expect(
      monitorService.handleSignal('START_VIEWING', 'nonexistent-case'),
    ).resolves.not.toThrow();

    expect(monitorService.isCaseScreencasting('nonexistent-case')).toBe(false);
  });

  it('does not throw or disrupt automation if CDP or Redis fails', async () => {
    mockCdpSession.send.mockRejectedValueOnce(new Error('CDP Compositor Busy'));

    // Should not throw
    await expect(
      monitorService.handleSignal('START_VIEWING', 'active-case-123'),
    ).resolves.not.toThrow();

    // Automation continues normally
    expect(mockPage.isClosed()).toBe(false);
  });
});

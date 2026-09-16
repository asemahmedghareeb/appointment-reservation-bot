import type { VfsAdapterConfig } from '../config/vfs-adapter-config.js';
import { VfsBrowserFactory } from './vfs-browser.factory.js';
import { VfsBrowserSession } from './vfs-browser-session.js';
import { logSafeBrowserEvent } from '../security/safe-browser-log.js';

export class VfsBrowserSessionManager {
  private readonly sessions = new Map<string, VfsBrowserSession>();
  private readonly factory: VfsBrowserFactory;

  public onSessionCreated?: (caseId: string, session: VfsBrowserSession) => void;
  public onSessionClosed?: (caseId: string) => void;

  constructor(
    private readonly config: VfsAdapterConfig,
    private readonly workerId: string = 'worker-1',
  ) {
    this.factory = new VfsBrowserFactory(config);
  }

  hasSession(caseId: string): boolean {
    return this.sessions.has(caseId);
  }

  getSession(caseId: string): VfsBrowserSession | undefined {
    return this.sessions.get(caseId);
  }

  async getOrCreateSession(
    caseId: string,
    storageStateJson?: string,
  ): Promise<VfsBrowserSession> {
    const existing = this.sessions.get(caseId);
    if (existing) {
      return existing;
    }

    logSafeBrowserEvent('Creating new VFS browser session', { caseId, workerId: this.workerId });
    const browser = await this.factory.createBrowser();
    const context = await this.factory.createContext(browser, storageStateJson);
    const page = await context.newPage();

    const session = new VfsBrowserSession(
      caseId,
      this.workerId,
      browser,
      context,
      page,
      this.config,
    );

    this.sessions.set(caseId, session);
    try {
      this.onSessionCreated?.(caseId, session);
    } catch {
      // Passive callback errors must never impact automation flow
    }
    return session;
  }

  async closeSession(caseId: string): Promise<void> {
    const session = this.sessions.get(caseId);
    if (session) {
      logSafeBrowserEvent('Closing VFS browser session', { caseId });
      this.sessions.delete(caseId);
      try {
        this.onSessionClosed?.(caseId);
      } catch {
        // Ignore
      }
      await session.close();
    }
  }

  async closeAll(): Promise<void> {
    for (const [caseId, session] of this.sessions.entries()) {
      try {
        this.onSessionClosed?.(caseId);
      } catch {
        // Ignore
      }
      await session.close().catch(() => {});
      this.sessions.delete(caseId);
    }
  }
}

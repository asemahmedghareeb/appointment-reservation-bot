import type { Page, BrowserContext, Browser } from 'playwright';
import { getSafeUrl, isOriginAllowed } from '../security/safe-url.js';
import { logSafeBrowserEvent } from '../security/safe-browser-log.js';
import type { VfsAdapterConfig } from '../config/vfs-adapter-config.js';
import { VfsSessionError } from '../errors/vfs-session.error.js';

export class VfsBrowserSession {
  constructor(
    public readonly caseId: string,
    public readonly workerId: string,
    public readonly browser: Browser,
    public readonly context: BrowserContext,
    public readonly page: Page,
    private readonly config: VfsAdapterConfig,
  ) {}

  async navigate(url: string): Promise<void> {
    const isAllowed = isOriginAllowed(url, this.config.allowedOrigins);
    if (!isAllowed) {
      throw new VfsSessionError(`Disallowed target URL origin: ${getSafeUrl(url)}`, this.caseId);
    }

    logSafeBrowserEvent('Navigating to safe URL', { caseId: this.caseId, safeUrl: getSafeUrl(url) });
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  getSafeCurrentPath(): string {
    return getSafeUrl(this.page.url());
  }

  async exportStorageState(): Promise<string> {
    const state = await this.context.storageState();
    return JSON.stringify(state);
  }

  async close(): Promise<void> {
    try {
      await this.page.close().catch(() => {});
      await this.context.close().catch(() => {});
      await this.browser.close().catch(() => {});
    } catch {
      // Ignore close failures
    }
  }
}

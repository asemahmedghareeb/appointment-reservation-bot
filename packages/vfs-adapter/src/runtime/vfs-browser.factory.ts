import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { VfsAdapterConfig } from '../config/vfs-adapter-config.js';

export class VfsBrowserFactory {
  constructor(private readonly config: VfsAdapterConfig) {}

  async createBrowser(): Promise<Browser> {
    return chromium.launch({
      headless: this.config.headless,
    });
  }

  async createContext(browser: Browser, storageStateJson?: string): Promise<BrowserContext> {
    let storageState: any = undefined;
    if (storageStateJson) {
      try {
        storageState = JSON.parse(storageStateJson);
      } catch {
        storageState = undefined;
      }
    }

    const context = await browser.newContext({
      ...(storageState ? { storageState } : {}),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    context.setDefaultTimeout(this.config.actionTimeoutMs);
    context.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);

    return context;
  }
}

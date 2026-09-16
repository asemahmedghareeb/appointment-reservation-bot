import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { VfsAdapterConfig } from '../config/vfs-adapter-config.js';

export class VfsBrowserFactory {
  constructor(private readonly config: VfsAdapterConfig) {}

  private buildProxyOptions(): { server: string; bypass?: string; username?: string; password?: string } | undefined {
    const p = this.config.proxy;
    if (!p) return undefined;
    return {
      server: p.server,
      ...(p.bypass !== undefined ? { bypass: p.bypass } : {}),
      ...(p.username !== undefined ? { username: p.username } : {}),
      ...(p.password !== undefined ? { password: p.password } : {}),
    };
  }

  async createBrowser(): Promise<Browser> {
    const proxy = this.buildProxyOptions();
    return chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
      ],
      ...(proxy ? { proxy } : {}),
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

    const proxy = this.buildProxyOptions();
    const context = await browser.newContext({
      ...(storageState ? { storageState } : {}),
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      ...(proxy ? { proxy } : {}),
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    context.setDefaultTimeout(this.config.actionTimeoutMs);
    context.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);

    return context;
  }
}

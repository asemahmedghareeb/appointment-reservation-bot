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
    const commonArgs = [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
    ];

    try {
      // Try launching genuine Google Chrome installed on system
      return await chromium.launch({
        headless: this.config.headless,
        channel: 'chrome',
        ignoreDefaultArgs: ['--enable-automation'],
        args: commonArgs,
        ...(proxy ? { proxy } : {}),
      });
    } catch {
      // Fallback to bundled Chromium if Google Chrome channel is unavailable
      return await chromium.launch({
        headless: this.config.headless,
        ignoreDefaultArgs: ['--enable-automation'],
        args: commonArgs,
        ...(proxy ? { proxy } : {}),
      });
    }
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
      viewport: this.config.headless ? { width: 1280, height: 800 } : null,
      locale: 'en-US',
      ...(proxy ? { proxy } : {}),
    });

    await this.applyStealth(context);
    context.setDefaultTimeout(this.config.actionTimeoutMs);
    context.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);

    return context;
  }

  async createPersistentContext(userDataDir: string, storageStateJson?: string): Promise<BrowserContext> {
    const proxy = this.buildProxyOptions();
    let storageState: any = undefined;
    if (storageStateJson) {
      try {
        storageState = JSON.parse(storageStateJson);
      } catch {
        storageState = undefined;
      }
    }

    const commonArgs = [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
    ];

    let context: BrowserContext;
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: this.config.headless,
        channel: 'chrome',
        viewport: this.config.headless ? { width: 1280, height: 800 } : null,
        ignoreDefaultArgs: ['--enable-automation'],
        args: commonArgs,
        ...(storageState ? { storageState } : {}),
        locale: 'en-US',
        ...(proxy ? { proxy } : {}),
      });
    } catch {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: this.config.headless,
        viewport: this.config.headless ? { width: 1280, height: 800 } : null,
        ignoreDefaultArgs: ['--enable-automation'],
        args: commonArgs,
        ...(storageState ? { storageState } : {}),
        locale: 'en-US',
        ...(proxy ? { proxy } : {}),
      });
    }

    await this.applyStealth(context);
    context.setDefaultTimeout(this.config.actionTimeoutMs);
    context.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);

    return context;
  }

  private async applyStealth(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      try {
        const proto = Object.getPrototypeOf(navigator);
        if (proto && 'webdriver' in proto) {
          Object.defineProperty(proto, 'webdriver', {
            get: () => false,
            configurable: true,
          });
        }
      } catch {}

      try {
        if (!('chrome' in window)) {
          // @ts-ignore
          window.chrome = {};
        }
        // @ts-ignore
        if (!window.chrome.runtime) {
          // @ts-ignore
          window.chrome.runtime = {};
        }
      } catch {}
    });
  }
}

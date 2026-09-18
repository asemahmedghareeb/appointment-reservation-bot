import { chromium, type Browser, type BrowserContext } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
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

  private findChromeExecutable(): string | undefined {
    if (this.config.chromePath && existsSync(this.config.chromePath)) {
      return this.config.chromePath;
    }

    const candidates: string[] = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];

    for (const p of candidates) {
      if (p && existsSync(p)) {
        return p;
      }
    }
    return undefined;
  }

  private async isCdpEndpointReady(cdpUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${cdpUrl}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async ensureChromeRunningOverCdp(port: number, userDataDir: string): Promise<string> {
    const cdpUrl = this.config.cdpUrl || `http://127.0.0.1:${port}`;

    if (await this.isCdpEndpointReady(cdpUrl)) {
      return cdpUrl;
    }

    const chromePath = this.findChromeExecutable();
    if (!chromePath) {
      throw new Error(`Google Chrome executable not found on system.`);
    }

    const chromeArgs = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-first-run',
      '--no-default-browser-check',
      '--start-maximized',
    ];

    if (this.config.headless) {
      chromeArgs.push('--headless=new');
    }

    if (this.config.proxy?.server) {
      chromeArgs.push(`--proxy-server=${this.config.proxy.server}`);
      if (this.config.proxy.bypass) {
        chromeArgs.push(`--proxy-bypass-list=${this.config.proxy.bypass}`);
      }
    }

    const proc = spawn(chromePath, chromeArgs, {
      detached: true,
      stdio: 'ignore',
    });
    proc.unref();

    // Poll until CDP endpoint is ready (up to 8 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 8000) {
      if (await this.isCdpEndpointReady(cdpUrl)) {
        return cdpUrl;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    throw new Error(`Chrome remote debugging port ${port} did not respond within timeout.`);
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

    // Attempt Stealth CDP connection if enabled
    if (this.config.useCdp) {
      try {
        const port = this.config.cdpPort || 9222;
        const cdpUrl = await this.ensureChromeRunningOverCdp(port, userDataDir);
        const browser = await chromium.connectOverCDP(cdpUrl);
        const contexts = browser.contexts();
        const context = contexts[0] || (await browser.newContext());

        await this.applyStealth(context);
        context.setDefaultTimeout(this.config.actionTimeoutMs);
        context.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);

        return context;
      } catch (err: any) {
        console.warn(`[VfsBrowserFactory] Stealth CDP connection failed: ${err.message}. Falling back to standard launch.`);
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

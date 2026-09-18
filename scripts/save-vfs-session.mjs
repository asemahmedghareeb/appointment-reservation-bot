import { chromium } from '../packages/vfs-adapter/node_modules/playwright/index.mjs';
import { prisma } from '../packages/database/dist/index.js';
import { encrypt, decrypt } from '../packages/crypto/dist/index.js';
import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.resolve(process.cwd(), '.vfs-session.json');
const USER_DATA_DIR = path.resolve(process.cwd(), '.chrome-vfs-profile');

async function main() {
  console.log('=====================================================');
  console.log('  VisaFlow One-Time Session Creator & Saver');
  console.log('=====================================================');

  // Load provider account
  const account = await prisma.providerAccount.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' }
  });

  const email = account?.email || 'asemelbadahy@gmail.com';
  const password = account ? decrypt(account.passwordEncrypted) : 'Cairo#2026!';

  console.log(`Account: ${email}`);
  console.log('Launching dedicated Chrome profile...');

  // Clean up any stale lock files from previous crashes
  try {
    for (const file of ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'lockfile']) {
      const lockPath = path.join(USER_DATA_DIR, file);
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    }
  } catch {}

  const proxy = process.env.VFS_PROXY_SERVER ? {
    server: process.env.VFS_PROXY_SERVER,
    ...(process.env.VFS_PROXY_USERNAME ? { username: process.env.VFS_PROXY_USERNAME } : {}),
    ...(process.env.VFS_PROXY_PASSWORD ? { password: process.env.VFS_PROXY_PASSWORD } : {}),
  } : undefined;

  // Use persistent context so cookies & Cloudflare trust are saved to disk
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--hide-crash-restore-bubble',
      '--disable-session-crashed-bubble',
      '--no-default-browser-check',
      '--start-maximized',
    ],
    ...(proxy ? { proxy } : {}),
  });

  await context.addInitScript(() => {
    try {
      const proto = Object.getPrototypeOf(navigator);
      if (proto && 'webdriver' in proto) {
        Object.defineProperty(proto, 'webdriver', { get: () => false, configurable: true });
      }
    } catch {}

    try {
      if (!('chrome' in window)) {
        window.chrome = {};
      }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {};
      }
    } catch {}
  });

  let activePage = context.pages()[0] || await context.newPage();
  context.on('page', (newPage) => {
    activePage = newPage;
  });

  console.log('Checking if session is already active on VFS Dashboard...');
  await activePage.goto('https://visa.vfsglobal.com/egy/en/grc/dashboard', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  }).catch(() => {});

  await activePage.waitForTimeout(2000);
  if (!activePage.url().includes('/dashboard') || activePage.url().includes('page-not-found')) {
    console.log('Navigating to VFS Global Greece Egypt login page...');
    await activePage.goto('https://visa.vfsglobal.com/egy/en/grc/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }).catch(() => {});
  }

  // If redirected to page-not-found, click "Go back to home" ONCE
  await activePage.waitForTimeout(2000);
  if (activePage.url().includes('page-not-found')) {
    const goBack = activePage.locator('a:has-text("Go back to home")').first();
    if (await goBack.isVisible().catch(() => false)) {
      console.log('Session expired notice detected, clicking "Go back to home"...');
      await goBack.click().catch(() => {});
      await activePage.waitForTimeout(3000);
      // Now click "Book now" in the same tab
      const bookNow = activePage.locator('a:has-text("Book now"), a[href*="/login"]').first();
      if (await bookNow.isVisible().catch(() => false)) {
        console.log('Opening login page...');
        const href = await bookNow.getAttribute('href');
        if (href) {
          await activePage.goto(href.startsWith('http') ? href : `https://visa.vfsglobal.com${href}`);
        } else {
          await bookNow.click().catch(() => {});
        }
      }
    }
  }

  console.log('-----------------------------------------------------');
  console.log('👉 Please complete the Cloudflare check and click Sign In.');
  console.log('👉 Email and password will auto-fill automatically as soon as inputs appear.');
  console.log('👉 Waiting for you to reach the VFS Dashboard (/dashboard)...');
  console.log('-----------------------------------------------------');

  // Background auto-fill watcher: only fills form fields, does NOT click links or spawn tabs
  let filledOnce = false;
  const fillInterval = setInterval(async () => {
    try {
      // Dismiss cookies banner if present
      const cookieBtn = activePage.locator('#onetrust-accept-btn-handler, button:has-text("Accept All Cookies")').first();
      if (await cookieBtn.isVisible().catch(() => false)) {
        await cookieBtn.click().catch(() => {});
      }

      const emailInput = activePage.locator('input[formcontrolname="username"], input[name="email"], input[type="email"]').first();
      const passwordInput = activePage.locator('input[formcontrolname="password"], input[name="password"], input[type="password"]').first();

      const hasPassword = await passwordInput.isVisible().catch(() => false);
      if (hasPassword) {
        const currentVal = await emailInput.inputValue().catch(() => '');
        if (!currentVal || currentVal !== email) {
          await emailInput.click().catch(() => {});
          await emailInput.fill(email).catch(() => {});
          await emailInput.dispatchEvent('input').catch(() => {});
          await emailInput.dispatchEvent('change').catch(() => {});

          await passwordInput.click().catch(() => {});
          await passwordInput.fill(password).catch(() => {});
          await passwordInput.dispatchEvent('input').catch(() => {});
          await passwordInput.dispatchEvent('change').catch(() => {});

          if (!filledOnce) {
            console.log('✅ Auto-filled Email and Password in login form!');
            filledOnce = true;
          }
        }
      }
    } catch {}
  }, 1000);

  // Wait until dashboard is reached on any open tab
  try {
    await Promise.race([
      activePage.waitForURL(/.*dashboard.*/, { timeout: 300000 }).catch(() => {}),
      new Promise((resolve) => {
        const check = setInterval(() => {
          for (const p of context.pages()) {
            if (p.url().includes('/dashboard')) {
              clearInterval(check);
              resolve(p);
              break;
            }
          }
        }, 1000);
      }),
    ]);
  } finally {
    clearInterval(fillInterval);
  }
  console.log('🎉 Dashboard reached successfully!');

  // Wait 3 seconds for tokens to settle in localStorage and cookies
  await activePage.waitForTimeout(3000);

  const storageState = await context.storageState();
  const sessionStorageMap = await activePage.evaluate(() => {
    const data = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) data[key] = sessionStorage.getItem(key);
    }
    return data;
  });
  const combinedSession = {
    ...storageState,
    sessionStorage: sessionStorageMap,
  };
  const storageStateJson = JSON.stringify(combinedSession, null, 2);

  // 1. Save to local file
  fs.writeFileSync(SESSION_FILE, storageStateJson, 'utf-8');
  console.log(`Saved session to file: ${SESSION_FILE}`);
  // Also save to apps/worker
  try {
    fs.writeFileSync(path.resolve(process.cwd(), 'apps', 'worker', '.vfs-session.json'), storageStateJson, 'utf-8');
  } catch {}

  // 2. Save encrypted to active AutomationSession or ProviderAccount
  if (account) {
    const encrypted = encrypt(storageStateJson);
    await prisma.automationSession.updateMany({
      where: { providerAccountId: account.id },
      data: { storageStateEncrypted: encrypted }
    });
    console.log('Saved encrypted session to Supabase database!');
  }

  console.log('=====================================================');
  console.log('✅ SUCCESS: Your VFS session is now fully saved!');
  console.log('The bot will now reuse this session and bypass login!');
  console.log('=====================================================');

  await context.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to save session:', err);
  process.exit(1);
});

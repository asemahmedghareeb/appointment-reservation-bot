import { VfsBrowserSessionManager, createVfsConfig } from 'file:///d:/development/nexly/appointment bot/packages/vfs-adapter/dist/index.js';
import * as fs from 'fs';
import * as path from 'path';

async function testDashboard() {
  const vfsConfig = createVfsConfig({
    headless: true,
    navigationTimeoutMs: 30000,
    actionTimeoutMs: 15000,
    allowedOrigins: ['https://visa.vfsglobal.com'],
  });

  const sessionManager = new VfsBrowserSessionManager(vfsConfig, 'test-dash-worker');
  const sessionJson = fs.readFileSync(path.resolve('.vfs-session.json'), 'utf-8');

  console.log('Creating session with saved state...');
  const session = await sessionManager.getOrCreateSession('dash-test', sessionJson);
  const page = session.page;

  console.log('Navigating to landing page first...');
  await page.goto('https://visa.vfsglobal.com/egy/en/grc', { waitUntil: 'domcontentloaded' }).catch(e => console.log('Landing nav error:', e.message));
  await page.waitForTimeout(3000);

  console.log('Navigating to dashboard...');
  await page.goto('https://visa.vfsglobal.com/egy/en/grc/dashboard', { waitUntil: 'domcontentloaded' }).catch(e => console.log('Dashboard nav error:', e.message));

  console.log('Waiting up to 15s to see what dashboard renders...');
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(2500);
    const url = page.url();
    const title = await page.title();
    const startBtn = await page.locator('button:has-text("Start New Booking"), a:has-text("Start New Booking")').count();
    const loginBtn = await page.locator('button:has-text("Sign In"), button:has-text("Sign in"), input[type="password"]').count();
    console.log(`[+${i * 2.5}s] URL: ${url} | Title: "${title}" | StartBookingBtn: ${startBtn} | LoginInputs: ${loginBtn}`);
  }

  await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/63d4cb2f-24e2-4397-8562-b6a1adbdae29/dash_test_result.png' });
  console.log('Screenshot saved to dash_test_result.png');

  await sessionManager.closeAll();
}

testDashboard().catch(console.error);

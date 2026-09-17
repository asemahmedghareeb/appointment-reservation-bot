import { chromium } from '../node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

async function testClickStart() {
  const sessionPath = path.resolve(process.cwd(), '.vfs-session.json');
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
  });

  if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
    await context.addCookies(sessionData.cookies);
  }

  const page = await context.newPage();

  if (sessionData.sessionStorage) {
    await page.addInitScript((storage) => {
      for (const [k, v] of Object.entries(storage)) {
        sessionStorage.setItem(k, v);
      }
    }, sessionData.sessionStorage);
  }

  console.log('Navigating to dashboard...');
  await page.goto('https://visa.vfsglobal.com/egy/en/grc/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('Directly navigating to application-detail...');
  await page.goto('https://visa.vfsglobal.com/egy/en/grc/application-detail', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);
  console.log('URL now:', page.url());

  // Check dropdowns on application-detail
  const selects = await page.$$eval('mat-select, select', (elements) =>
    elements.map((el) => ({
      tag: el.tagName,
      formControlName: el.getAttribute('formcontrolname'),
      id: el.id,
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder') || el.innerText.trim(),
      visible: el.offsetParent !== null
    }))
  );
  console.log('Found selects on application-detail:', JSON.stringify(selects, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'scripts/application-detail-test.png' });
  console.log('Saved screenshot to scripts/application-detail-test.png');

  await browser.close();
}

testClickStart().catch(console.error);

import { chromium } from '../node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs';
import path from 'path';

async function testPersistentStart() {
  const userDataDir = path.resolve(process.cwd(), '.chrome-vfs-profile');
  console.log('Launching persistent context from:', userDataDir);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = context.pages()[0] || await context.newPage();

  console.log('Navigating to dashboard...');
  await page.goto('https://visa.vfsglobal.com/egy/en/grc/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  console.log('Current URL on dashboard:', page.url());

  const visibleBtn = page.locator('button:has-text("Start New Booking"):visible, a:has-text("Start New Booking"):visible').first();
  console.log('Visible button count:', await visibleBtn.count());

  if (await visibleBtn.count() > 0) {
    console.log('Clicking visible Start New Booking button...');
    await visibleBtn.click();
    console.log('Clicked. Waiting 6 seconds...');
    await page.waitForTimeout(6000);
    console.log('URL after click:', page.url());

    // Check selects
    const selects = await page.$$eval('mat-select, select', (elements) =>
      elements.map((el) => ({
        tag: el.tagName,
        formControlName: el.getAttribute('formcontrolname'),
        id: el.id,
        name: el.getAttribute('name'),
        text: el.innerText.trim(),
        visible: el.offsetParent !== null,
      }))
    );
    console.log('Found selects:', JSON.stringify(selects, null, 2));

    await page.screenshot({ path: 'scripts/after-start-booking.png' });
    console.log('Screenshot saved to scripts/after-start-booking.png');
  }

  await context.close();
}

testPersistentStart().catch(console.error);

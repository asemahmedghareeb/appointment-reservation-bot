import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const EMAIL = process.env.VFS_EMAIL || 'asemelbadahy@gmail.com';
const PASSWORD = process.env.VFS_PASSWORD || 'Cairo#2026!';

const COUNTRIES = [
  { code: 'prt', name: 'Portugal', dest: 'PT' },
  { code: 'grc', name: 'Greece', dest: 'GR' },
  { code: 'aut', name: 'Austria', dest: 'AT' },
  { code: 'hun', name: 'Hungary', dest: 'HU' },
];

async function run() {
  console.log('Launching visible Chromium browser to fetch VFS live master data...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  const collectedData = {};

  // Intercept any VFS master data REST responses
  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (
        (url.includes('/master/') ||
          url.includes('/master-data/') ||
          url.includes('center') ||
          url.includes('category') ||
          url.includes('sub-category')) &&
        response.status() === 200 &&
        response.headers()['content-type']?.includes('application/json')
      ) {
        const data = await response.json();
        console.log(`[API Intercepted] ${url.substring(0, 80)}...`);
        if (!collectedData.rawApi) collectedData.rawApi = [];
        collectedData.rawApi.push({ url, data });
      }
    } catch {}
  });

  console.log('Navigating to VFS Portugal login page...');
  await page.goto('https://visa.vfsglobal.com/egy/en/prt/login', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  // Handle Cookie banner if present
  try {
    const cookieBtn = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept All")');
    if (await cookieBtn.isVisible({ timeout: 4000 })) {
      await cookieBtn.click();
      console.log('Accepted cookie banner');
    }
  } catch {}

  console.log('Attempting login with provided credentials...');
  try {
    const emailInput = page.locator('input[name="email"], input[type="email"], #email').first();
    const passInput = page.locator('input[name="password"], input[type="password"], #password').first();

    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill(EMAIL);
      await passInput.fill(PASSWORD);
      console.log('Filled email and password.');

      const signInBtn = page.locator('button[type="submit"], button:has-text("Sign In")').first();
      await signInBtn.click();
      console.log('Clicked Sign In.');
    }
  } catch (err) {
    console.log('Login form not immediately interactive or already logged in:', err.message);
  }

  console.log(
    'Waiting for login to complete (please solve Cloudflare / OTP if prompted on screen)...'
  );
  try {
    await page.waitForURL(
      (url) =>
        url.pathname.includes('/dashboard') ||
        url.pathname.includes('/application-detail') ||
        url.pathname.includes('/home'),
      { timeout: 90000 }
    );
    console.log('Successfully logged in! Current URL:', page.url());
  } catch {
    console.log('Timeout waiting for automatic redirect. Will proceed with current page...');
  }

  // Iterate through each country
  for (const country of COUNTRIES) {
    console.log(`\n========================================`);
    console.log(`Inspecting country: ${country.name} (${country.dest}) [code: ${country.code}]`);
    console.log(`========================================`);

    const targetUrl = `https://visa.vfsglobal.com/egy/en/${country.code}/application-detail`;
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
    } catch {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }

    await page.waitForTimeout(3000);

    // Look for Application Centre dropdown
    const countryResult = {
      country: country.name,
      destinationCountry: country.dest,
      centres: [],
    };

    try {
      // Find centre select element
      const centreSelect = page.locator(
        'mat-select[formcontrolname="centerCode"], mat-select#centre, select[name="centre"], [formcontrolname="centerCode"]'
      ).first();

      if (await centreSelect.isVisible({ timeout: 5000 })) {
        await centreSelect.click();
        await page.waitForTimeout(1000);

        const options = page.locator('mat-option, [role="option"]');
        const count = await options.count();
        console.log(`Found ${count} centre options for ${country.name}`);

        const centreNames = [];
        for (let i = 0; i < count; i++) {
          const text = (await options.nth(i).textContent())?.trim();
          if (text) centreNames.push(text);
        }

        // Close dropdown
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);

        console.log(`Centres for ${country.name}:`, centreNames);

        // For each centre, inspect categories
        for (const centreName of centreNames) {
          const centreData = { centreName, categories: [] };

          // Re-open and select this centre
          await centreSelect.click();
          await page.waitForTimeout(500);
          const targetOpt = page.locator('mat-option, [role="option"]').filter({ hasText: centreName }).first();
          if (await targetOpt.count() > 0) {
            await targetOpt.click();
            await page.waitForTimeout(1500);
          }

          // Read category select
          const categorySelect = page.locator(
            'mat-select[formcontrolname="visaCategoryCode"], [formcontrolname="visaCategoryCode"]'
          ).first();

          if (await categorySelect.isVisible({ timeout: 4000 })) {
            await categorySelect.click();
            await page.waitForTimeout(1000);

            const catOptions = page.locator('mat-option, [role="option"]');
            const catCount = await catOptions.count();
            const categoryNames = [];
            for (let c = 0; c < catCount; c++) {
              const text = (await catOptions.nth(c).textContent())?.trim();
              if (text) categoryNames.push(text);
            }
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(500);

            console.log(`  Categories under "${centreName}":`, categoryNames);

            // For each category, inspect subcategories
            for (const catName of categoryNames) {
              const catData = { categoryName: catName, subcategories: [] };

              await categorySelect.click();
              await page.waitForTimeout(500);
              const targetCatOpt = page.locator('mat-option, [role="option"]').filter({ hasText: catName }).first();
              if (await targetCatOpt.count() > 0) {
                await targetCatOpt.click();
                await page.waitForTimeout(1500);
              }

              // Read subcategory select
              const subcatSelect = page.locator(
                'mat-select[formcontrolname="visaSubCategoryCode"], [formcontrolname="visaSubCategoryCode"]'
              ).first();

              if (await subcatSelect.isVisible({ timeout: 4000 })) {
                await subcatSelect.click();
                await page.waitForTimeout(1000);

                const subcatOptions = page.locator('mat-option, [role="option"]');
                const subcatCount = await subcatOptions.count();
                for (let s = 0; s < subcatCount; s++) {
                  const text = (await subcatOptions.nth(s).textContent())?.trim();
                  if (text) catData.subcategories.push(text);
                }
                await page.keyboard.press('Escape').catch(() => {});
                await page.waitForTimeout(500);

                console.log(`    Subcategories under "${catName}":`, catData.subcategories);
              }

              centreData.categories.push(catData);
            }
          }

          countryResult.centres.push(centreData);
        }
      }
    } catch (err) {
      console.log(`Error reading dropdowns for ${country.name}:`, err.message);
    }

    collectedData[country.code] = countryResult;
  }

  // Write collected data to disk
  const outPath = path.resolve('scripts', 'vfs-live-data.json');
  fs.writeFileSync(outPath, JSON.stringify(collectedData, null, 2), 'utf-8');
  console.log(`\nMaster data saved successfully to ${outPath}`);

  await browser.close();
}

run().catch((err) => {
  console.error('Extraction script error:', err);
  process.exit(1);
});

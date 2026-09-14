import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { SyntheticVfsServer } from './test-server/synthetic-vfs-server.js';
import { VfsPageClassifier, VfsPageType } from '../src/detection/vfs-page-classifier.js';

describe('VfsPageClassifier', () => {
  let server: SyntheticVfsServer;
  let serverUrl: string;
  let browser: Browser;
  let page: Page;
  let classifier: VfsPageClassifier;

  beforeAll(async () => {
    server = new SyntheticVfsServer();
    serverUrl = await server.start();
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    classifier = new VfsPageClassifier();
  });

  afterAll(async () => {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await server?.stop().catch(() => {});
  });

  it('classifies login page as LOGIN', async () => {
    server.setScenario('HAPPY_PATH');
    await page.goto(`${serverUrl}/login`);
    const type = await classifier.classify(page);
    expect(type).toBe(VfsPageType.LOGIN);
  });

  it('classifies dashboard page as BOOKING_HOME', async () => {
    await page.goto(`${serverUrl}/dashboard`);
    const type = await classifier.classify(page);
    expect(type).toBe(VfsPageType.BOOKING_HOME);
  });

  it('classifies appointment-details page as APPOINTMENT_DETAILS', async () => {
    await page.goto(`${serverUrl}/appointment-details`);
    const type = await classifier.classify(page);
    expect(type).toBe(VfsPageType.APPOINTMENT_DETAILS);
  });

  it('classifies applicants page as APPLICANT_DETAILS', async () => {
    await page.goto(`${serverUrl}/applicants`);
    const type = await classifier.classify(page);
    expect(type).toBe(VfsPageType.APPLICANT_DETAILS);
  });

  it('classifies slot-selection page as SLOT_SELECTION', async () => {
    await page.goto(`${serverUrl}/slot-selection`);
    const type = await classifier.classify(page);
    expect(type).toBe(VfsPageType.SLOT_SELECTION);
  });

  it('classifies payment page as PAYMENT', async () => {
    await page.goto(`${serverUrl}/payment`);
    const type = await classifier.classify(page);
    expect(type).toBe(VfsPageType.PAYMENT);
  });

  it('classifies confirmation page as CONFIRMATION', async () => {
    await page.goto(`${serverUrl}/confirmation`);
    const type = await classifier.classify(page);
    expect(type).toBe(VfsPageType.CONFIRMATION);
  });

  it('classifies captcha challenge as HUMAN_VERIFICATION', async () => {
    await page.goto(`${serverUrl}/captcha`);
    const type = await classifier.classify(page);
    expect(type).toBe(VfsPageType.HUMAN_VERIFICATION);
  });
});

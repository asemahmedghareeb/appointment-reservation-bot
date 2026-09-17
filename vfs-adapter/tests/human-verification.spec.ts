import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { SyntheticVfsServer } from './test-server/synthetic-vfs-server.js';
import { HumanVerificationDetector } from '../src/detection/human-verification.detector.js';
import { HumanActionType } from '@visaflow/provider-core';

describe('HumanVerificationDetector', () => {
  let server: SyntheticVfsServer;
  let serverUrl: string;
  let browser: Browser;
  let page: Page;
  let detector: HumanVerificationDetector;

  beforeAll(async () => {
    server = new SyntheticVfsServer();
    serverUrl = await server.start();
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    detector = new HumanVerificationDetector();
  });

  afterAll(async () => {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await server?.stop().catch(() => {});
  });

  it('detects CAPTCHA container without interacting with challenge internals', async () => {
    await page.goto(`${serverUrl}/captcha`);
    const res = await detector.detect(page);

    expect(res.detected).toBe(true);
    expect(res.actionType).toBe(HumanActionType.CAPTCHA);
  });

  it('detects OTP form without generating or guessing OTP', async () => {
    await page.goto(`${serverUrl}/otp`);
    const res = await detector.detect(page);

    expect(res.detected).toBe(true);
    expect(res.actionType).toBe(HumanActionType.OTP);
  });

  it('returns detected: false for normal login page', async () => {
    server.setScenario('HAPPY_PATH');
    await page.goto(`${serverUrl}/login`);
    const res = await detector.detect(page);

    expect(res.detected).toBe(false);
  });
});

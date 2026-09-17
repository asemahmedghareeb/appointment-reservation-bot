import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';
import type { VfsCredentials } from '../credentials/vfs-credentials-provider.js';
import { VfsAuthenticationError } from '../errors/vfs-authentication.error.js';

export class LoginPage extends BaseVfsPage {
  get expectedPageType(): VfsPageType {
    return VfsPageType.LOGIN;
  }

  async login(credentials: VfsCredentials): Promise<void> {
    // 1. Dismiss cookie consent banner if present
    try {
      const cookieBtn = this.page.locator(
        '#onetrust-accept-btn-handler, button:has-text("Accept All Cookies"), button:has-text("Accept All")'
      ).first();
      if (await cookieBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await cookieBtn.click({ force: true }).catch(() => {});
        this.log('Dismissed cookie consent banner');
        await this.page.waitForTimeout(1000);
      }
    } catch {}

    // Check if already on dashboard
    if (this.page.url().includes('page-not-found')) {
      const goBack = this.page.locator('a:has-text("Go back to home")').first();
      if (await goBack.isVisible().catch(() => false)) {
        this.log('Detected page-not-found, clicking "Go back to home"...');
        await goBack.click().catch(() => {});
        await this.page.waitForTimeout(3000);
      }
    }

    const isDashboardNow = !this.page.url().includes('page-not-found') &&
      await this.page.locator('button:has-text("Start New Booking"), a:has-text("Start New Booking")').isVisible().catch(() => false);
    if (isDashboardNow) {
      this.log('Already authenticated and on VFS Dashboard');
      return;
    }

    // 2. Wait for either the login form inputs to appear OR dashboard OR human challenge
    try {
      await Promise.race([
        this.page.waitForSelector(VFS_SELECTORS.login.emailInput, { timeout: 30000 }),
        this.page.waitForSelector('button:has-text("Start New Booking"), a:has-text("Start New Booking")', { timeout: 30000 }),
        this.page.waitForSelector(VFS_SELECTORS.humanVerification.captchaContainer, { timeout: 30000 }),
        this.page.waitForSelector(':text("Session Expired"), :text("session has expired")', { timeout: 15000 }),
      ]);
    } catch {}

    const isDashboardAfterWait = !this.page.url().includes('page-not-found') &&
      await this.page.locator('button:has-text("Start New Booking"), a:has-text("Start New Booking")').isVisible().catch(() => false);
    if (isDashboardAfterWait) {
      this.log('Already authenticated and on VFS Dashboard');
      return;
    }

    const emailOrUsername = credentials.email ?? credentials.username;
    if (!emailOrUsername) {
      throw new VfsAuthenticationError('Neither email nor username provided in credentials.');
    }

    // Dismiss cookies if covering the form
    try {
      const cookie = this.page.locator('#onetrust-accept-btn-handler, button:has-text("Accept All Cookies")').first();
      if (await cookie.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cookie.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(1000);
      }
    } catch {}

    this.log('Filling login form fields (email and password)');
    const emailLocator = this.page.locator(VFS_SELECTORS.login.emailInput).first();
    const passwordLocator = this.page.locator(VFS_SELECTORS.login.passwordInput).first();
    const submitBtn = this.page.locator(VFS_SELECTORS.login.submitButton).first();

    await emailLocator.waitFor({ state: 'visible', timeout: 30000 });
    await emailLocator.click().catch(() => {});
    await emailLocator.fill(emailOrUsername);
    await emailLocator.dispatchEvent('input').catch(() => {});
    await emailLocator.dispatchEvent('change').catch(() => {});

    await passwordLocator.waitFor({ state: 'visible', timeout: 30000 });
    await passwordLocator.click().catch(() => {});
    await passwordLocator.fill(credentials.password);
    await passwordLocator.dispatchEvent('input').catch(() => {});
    await passwordLocator.dispatchEvent('change').catch(() => {});

    this.log('Email and password filled successfully. Waiting for Turnstile verification...');

    // Wait up to 60s for Turnstile to verify and enable the button
    try {
      await this.page.waitForFunction(
        () => {
          const btn = document.querySelector('button[type="submit"], button.btn-brand-orange') as HTMLButtonElement | null;
          return btn && !btn.disabled && !btn.classList.contains('mat-mdc-button-disabled');
        },
        { timeout: 60000 }
      );
      this.log('Sign In button is now ENABLED!');
    } catch {
      this.log('Sign In button wait timed out, attempting click anyway');
    }

    this.log('Submitting login form');
    await submitBtn.click({ force: true }).catch(async () => {
      await this.waitAndClick(submitBtn, 10000);
    });

    // Wait for navigation to dashboard or application-detail
    this.log('Waiting for post-login redirect to dashboard...');
    await this.page.waitForURL(
      (url) => url.pathname.includes('/dashboard') || url.pathname.includes('/application-detail'),
      { timeout: 45000 }
    ).catch(() => {});
    await this.page.waitForTimeout(2000);
  }
}

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

    // 2. Wait for either the login form inputs to appear OR a human challenge/block
    try {
      await Promise.race([
        this.page.waitForSelector(VFS_SELECTORS.login.emailInput, { timeout: 15000 }),
        this.page.waitForSelector(VFS_SELECTORS.humanVerification.captchaContainer, { timeout: 15000 }),
        this.page.waitForSelector(':text("Session Expired"), :text("session has expired")', { timeout: 15000 }),
      ]);
    } catch {}

    // 3. Handle "Session Expired or Invalid" screen if encountered
    const sessionExpiredNotice = this.page.locator(':text("Session Expired"), :text("session has expired")').first();
    if (await sessionExpiredNotice.isVisible({ timeout: 2000 }).catch(() => false)) {
      this.log('Session expired notice detected on page');
      const signInAgainBtn = this.page.locator(
        'a:has-text("Sign In Again"), button:has-text("Sign In Again"), a:has-text("Sign In"), a:has-text("Go back to home")'
      ).first();
      if (await signInAgainBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        this.log('Clicking Sign In Again link');
        await signInAgainBtn.click({ force: true }).catch(() => {});
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      } else {
        // Fallback: replace pathname with /login
        const url = new URL(this.page.url());
        url.pathname = url.pathname.replace(/\/application-detail.*/, '/login');
        this.log('Redirecting to login URL', { target: url.toString() });
        await this.page.goto(url.toString(), { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      await this.page.waitForTimeout(2000);
    }

    this.log('Checking for human challenge before login submission');
    const challenge = await this.checkHumanVerification();
    if (challenge.detected) {
      this.log('Human verification detected on login page', { details: challenge.details });
      throw new VfsAuthenticationError(challenge.details || 'Human verification required', false);
    }

    const emailOrUsername = credentials.email ?? credentials.username;
    if (!emailOrUsername) {
      throw new VfsAuthenticationError('Neither email nor username provided in credentials.');
    }

    this.log('Filling login form fields');
    const emailLocator = this.page.locator(VFS_SELECTORS.login.emailInput).first();
    const passwordLocator = this.page.locator(VFS_SELECTORS.login.passwordInput).first();
    const submitBtn = this.page.locator(VFS_SELECTORS.login.submitButton).first();

    await this.waitAndFill(emailLocator, emailOrUsername);
    await this.waitAndFill(passwordLocator, credentials.password);

    this.log('Submitting login form');
    await this.waitAndClick(submitBtn);

    // Wait for navigation / state change
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  }
}

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
    this.log('Checking for human challenge before login submission');
    const challenge = await this.checkHumanVerification();
    if (challenge.detected) {
      this.log('Human verification detected on login page');
      return;
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

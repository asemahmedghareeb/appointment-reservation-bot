import type { Page } from 'playwright';
import { HumanActionType } from '@visaflow/provider-core';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';

export interface HumanVerificationDetectionResult {
  detected: boolean;
  actionType?: HumanActionType;
  details?: string;
}

export class HumanVerificationDetector {
  async detect(page: Page): Promise<HumanVerificationDetectionResult> {
    try {
      // 1. Check for CAPTCHA / Turnstile / Cloudflare challenge
      const captchaLocator = page.locator(VFS_SELECTORS.humanVerification.captchaContainer);
      if (await captchaLocator.count() > 0) {
        const isVisible = await captchaLocator.first().isVisible().catch(() => false);
        if (isVisible) {
          return {
            detected: true,
            actionType: HumanActionType.CAPTCHA,
            details: 'Captcha or security challenge container detected on page.',
          };
        }
      }

      // 2. Check for OTP input / form
      const otpLocator = page.locator(VFS_SELECTORS.humanVerification.otpContainer);
      if (await otpLocator.count() > 0) {
        const isVisible = await otpLocator.first().isVisible().catch(() => false);
        if (isVisible) {
          return {
            detected: true,
            actionType: HumanActionType.OTP,
            details: 'OTP verification challenge container detected on page.',
          };
        }
      }

      // 3. Check for manual verification page / banner
      const manualLocator = page.locator(VFS_SELECTORS.humanVerification.manualVerification);
      if (await manualLocator.count() > 0) {
        const isVisible = await manualLocator.first().isVisible().catch(() => false);
        if (isVisible) {
          return {
            detected: true,
            actionType: HumanActionType.MANUAL_VERIFICATION,
            details: 'Manual verification notice detected on page.',
          };
        }
      }

      // 4. Text-based heuristic checks
      const bodyText = await page.textContent('body').catch(() => '') || '';
      if (
        /please verify you are human|turnstile|verify your identity with otp|one-time password/i.test(bodyText)
      ) {
        if (/otp|one-time password/i.test(bodyText)) {
          return {
            detected: true,
            actionType: HumanActionType.OTP,
            details: 'OTP verification challenge detected from page text.',
          };
        }
        return {
          detected: true,
          actionType: HumanActionType.CAPTCHA,
          details: 'Security verification challenge detected from page text.',
        };
      }

      return { detected: false };
    } catch {
      return { detected: false };
    }
  }
}

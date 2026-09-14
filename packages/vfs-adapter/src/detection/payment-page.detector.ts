import type { Page } from 'playwright';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';

export interface PaymentPageDetectionResult {
  isPaymentPage: boolean;
  amount?: string;
  currency?: string;
  externalReference?: string;
  deadlineMinutes?: number;
}

export class PaymentPageDetector {
  async detect(page: Page): Promise<PaymentPageDetectionResult> {
    try {
      const url = page.url();
      const bodyText = await page.textContent('body').catch(() => '') || '';

      const isUrlMatch = /\/payment|\/checkout|\/fee/i.test(url);
      const isHeadingMatch = await page.locator(`h1:has-text("${VFS_SELECTORS.payment.heading}"), h2:has-text("${VFS_SELECTORS.payment.heading}")`).count() > 0;
      const isPayButtonPresent = await page.locator(VFS_SELECTORS.payment.payButton).count() > 0;

      if (isUrlMatch || isHeadingMatch || (isPayButtonPresent && /payment|total fee|amount to pay/i.test(bodyText))) {
        let amount: string | undefined;
        let currency: string | undefined;
        let externalReference: string | undefined;

        const amountEl = page.locator(VFS_SELECTORS.payment.amount);
        if (await amountEl.count() > 0) {
          amount = (await amountEl.first().textContent())?.trim() || undefined;
        }

        const currencyEl = page.locator(VFS_SELECTORS.payment.currency);
        if (await currencyEl.count() > 0) {
          currency = (await currencyEl.first().textContent())?.trim() || undefined;
        }

        const refEl = page.locator(VFS_SELECTORS.payment.externalReference);
        if (await refEl.count() > 0) {
          externalReference = (await refEl.first().textContent())?.trim() || undefined;
        }

        // Fallback regex detection on body
        if (!amount) {
          const match = /(\d+(?:\.\d{2})?)\s*(EUR|USD|EGP|GBP)/i.exec(bodyText);
          if (match) {
            amount = match[1];
            currency = match[2]?.toUpperCase();
          }
        }

        return {
          isPaymentPage: true,
          currency: currency ?? 'EUR',
          deadlineMinutes: 15,
          ...(amount ? { amount } : {}),
          ...(externalReference ? { externalReference } : {}),
        };
      }

      return { isPaymentPage: false };
    } catch {
      return { isPaymentPage: false };
    }
  }
}

import type { Page } from 'playwright';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';

export interface ConfirmationDetectionResult {
  isConfirmed: boolean;
  bookingReference?: string;
  centre?: string;
  appointmentDate?: string;
}

export class ConfirmationPageDetector {
  async detect(page: Page): Promise<ConfirmationDetectionResult> {
    try {
      const headingCount = await page.locator(`h1:has-text("${VFS_SELECTORS.confirmation.heading}"), h2:has-text("${VFS_SELECTORS.confirmation.heading}")`).count();
      const bodyText = await page.textContent('body').catch(() => '') || '';
      const hasConfirmationText = /appointment confirmed|booking confirmed|has been scheduled successfully/i.test(bodyText);

      if (headingCount > 0 || hasConfirmationText) {
        let bookingReference: string | undefined;

        const refEl = page.locator(VFS_SELECTORS.confirmation.referenceNumber);
        if (await refEl.count() > 0) {
          bookingReference = (await refEl.first().textContent())?.trim() || undefined;
        }

        if (!bookingReference) {
          // Extract from text via regex e.g. VFS/EGY/12345 or REF: 123456
          const match = /(?:Reference|Booking\s*Ref|Confirmation\s*Number)[:\s#]*([A-Z0-9\/-]+)/i.exec(bodyText);
          if (match) {
            bookingReference = match[1];
          }
        }

        return {
          isConfirmed: true,
          bookingReference: bookingReference ?? 'CONFIRMED_REF',
        };
      }

      return { isConfirmed: false };
    } catch {
      return { isConfirmed: false };
    }
  }
}

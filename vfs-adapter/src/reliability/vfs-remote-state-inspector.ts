import type { Page } from 'playwright';
import { VfsPageClassifier, VfsPageType } from '../detection/vfs-page-classifier.js';

export enum VfsRemoteState {
  AUTHENTICATED_HOME = 'AUTHENTICATED_HOME',
  BOOKING_STARTED = 'BOOKING_STARTED',
  APPLICANTS_SUBMITTED = 'APPLICANTS_SUBMITTED',
  APPOINTMENT_SELECTED = 'APPOINTMENT_SELECTED',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  CONFIRMED = 'CONFIRMED',
  HUMAN_CHALLENGE = 'HUMAN_CHALLENGE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNKNOWN = 'UNKNOWN',
}

export interface VfsInspectionResult {
  remoteState: VfsRemoteState;
  pageType: VfsPageType;
  currentUrl: string;
  confirmationReference?: string | undefined;
  paymentUrl?: string | undefined;
}

export class VfsRemoteStateInspector {
  private static readonly classifier = new VfsPageClassifier();

  static async inspect(page: Page): Promise<VfsInspectionResult> {
    const currentUrl = page.url();
    const pageType = await this.classifier.classify(page);

    switch (pageType) {
      case VfsPageType.CONFIRMATION: {
        let confirmationReference: string | undefined;
        try {
          const refEl = page.locator('#confirmation-number, [data-testid="booking-ref"], .booking-reference');
          if ((await refEl.count()) > 0) {
            confirmationReference = (await refEl.first().innerText()).trim();
          }
        } catch {
          // ignore
        }
        return {
          remoteState: VfsRemoteState.CONFIRMED,
          pageType,
          currentUrl,
          confirmationReference,
        };
      }

      case VfsPageType.PAYMENT: {
        return {
          remoteState: VfsRemoteState.PAYMENT_REQUIRED,
          pageType,
          currentUrl,
          paymentUrl: currentUrl,
        };
      }

      case VfsPageType.SLOT_SELECTION: {
        return {
          remoteState: VfsRemoteState.APPLICANTS_SUBMITTED,
          pageType,
          currentUrl,
        };
      }

      case VfsPageType.APPLICANT_DETAILS: {
        return {
          remoteState: VfsRemoteState.BOOKING_STARTED,
          pageType,
          currentUrl,
        };
      }

      case VfsPageType.APPOINTMENT_DETAILS:
      case VfsPageType.BOOKING_HOME: {
        return {
          remoteState: VfsRemoteState.AUTHENTICATED_HOME,
          pageType,
          currentUrl,
        };
      }

      case VfsPageType.HUMAN_VERIFICATION: {
        return {
          remoteState: VfsRemoteState.HUMAN_CHALLENGE,
          pageType,
          currentUrl,
        };
      }

      case VfsPageType.LOGIN: {
        return {
          remoteState: VfsRemoteState.SESSION_EXPIRED,
          pageType,
          currentUrl,
        };
      }

      default: {
        return {
          remoteState: VfsRemoteState.UNKNOWN,
          pageType,
          currentUrl,
        };
      }
    }
  }
}

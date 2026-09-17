import type { Page } from 'playwright';
import { HumanVerificationDetector } from './human-verification.detector.js';
import { PaymentPageDetector } from './payment-page.detector.js';
import { ConfirmationPageDetector } from './confirmation-page.detector.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';

export enum VfsPageType {
  LOGIN = 'LOGIN',
  BOOKING_HOME = 'BOOKING_HOME',
  APPOINTMENT_DETAILS = 'APPOINTMENT_DETAILS',
  APPLICANT_DETAILS = 'APPLICANT_DETAILS',
  SLOT_SELECTION = 'SLOT_SELECTION',
  PAYMENT = 'PAYMENT',
  CONFIRMATION = 'CONFIRMATION',
  HUMAN_VERIFICATION = 'HUMAN_VERIFICATION',
  UNKNOWN = 'UNKNOWN',
}

export class VfsPageClassifier {
  private readonly humanDetector = new HumanVerificationDetector();
  private readonly paymentDetector = new PaymentPageDetector();
  private readonly confirmationDetector = new ConfirmationPageDetector();

  async classify(page: Page): Promise<VfsPageType> {
    // 1. Check human verification first
    const humanRes = await this.humanDetector.detect(page);
    if (humanRes.detected) {
      return VfsPageType.HUMAN_VERIFICATION;
    }

    // 2. Check confirmation
    const confirmRes = await this.confirmationDetector.detect(page);
    if (confirmRes.isConfirmed) {
      return VfsPageType.CONFIRMATION;
    }

    // 3. Check payment
    const paymentRes = await this.paymentDetector.detect(page);
    if (paymentRes.isPaymentPage) {
      return VfsPageType.PAYMENT;
    }

    const url = page.url();
    const bodyText = await page.textContent('body').catch(() => '') || '';

    // 4. Check Login
    const hasLoginHeading = await page.locator(`h1:has-text("${VFS_SELECTORS.login.heading}"), h2:has-text("${VFS_SELECTORS.login.heading}")`).count() > 0;
    const hasPasswordInput = await page.locator(VFS_SELECTORS.login.passwordInput).count() > 0;
    if (/\/login/i.test(url) || (hasLoginHeading && hasPasswordInput) || hasPasswordInput) {
      return VfsPageType.LOGIN;
    }

    // 5. Check Slot Selection
    const hasSlotHeading = await page.locator(`h1:has-text("${VFS_SELECTORS.slotSelection.heading}"), h2:has-text("${VFS_SELECTORS.slotSelection.heading}")`).count() > 0;
    const hasSlotItems = await page.locator(VFS_SELECTORS.slotSelection.slotItem).count() > 0;
    if (/\/slot|\/schedule/i.test(url) || (hasSlotHeading && hasSlotItems)) {
      return VfsPageType.SLOT_SELECTION;
    }

    // 6. Check Applicant Details
    const hasApplicantHeading = await page.locator(`h1:has-text("${VFS_SELECTORS.applicantDetails.heading}"), h2:has-text("${VFS_SELECTORS.applicantDetails.heading}")`).count() > 0;
    const hasPassportInput = await page.locator(VFS_SELECTORS.applicantDetails.passportNumber).count() > 0;
    if (/\/applicant/i.test(url) || hasApplicantHeading || hasPassportInput) {
      return VfsPageType.APPLICANT_DETAILS;
    }

    // 7. Check Appointment Details
    const hasApptHeading = await page.locator(`h1:has-text("${VFS_SELECTORS.appointmentDetails.heading}"), h2:has-text("${VFS_SELECTORS.appointmentDetails.heading}")`).count() > 0;
    const hasCentreSelect = await page.locator(VFS_SELECTORS.appointmentDetails.centreSelect).count() > 0;
    if (/\/appointment-details|\/application-detail|\/route/i.test(url) || hasApptHeading || hasCentreSelect) {
      return VfsPageType.APPOINTMENT_DETAILS;
    }

    // 8. Check Booking Home
    const hasHomeHeading = await page.locator(`h1:has-text("${VFS_SELECTORS.bookingHome.heading}"), h2:has-text("${VFS_SELECTORS.bookingHome.heading}")`).count() > 0;
    const hasStartBtn = await page.locator(VFS_SELECTORS.bookingHome.startNewBookingButton).count() > 0;
    if (/\/dashboard|\/home/i.test(url) || hasStartBtn || hasHomeHeading) {
      return VfsPageType.BOOKING_HOME;
    }

    return VfsPageType.UNKNOWN;
  }
}

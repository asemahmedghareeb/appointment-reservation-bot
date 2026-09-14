import {
  BookingCaseStatus,
  type VisaProviderAdapter,
  type ProviderContext,
  type SlotCandidate,
  type ProviderApplicantInput,
  type AuthenticateResult,
  type RouteInspectionResult,
  type AvailabilityResult,
  type BookingResult,
  type ApplicantSubmissionResult,
  type AppointmentSelectionResult,
  type PaymentStateResult,
  type ConfirmationResult,
  type ResumeResult,
  HumanActionType,
} from '@visaflow/provider-core';
import type { VfsBrowserSessionManager } from './runtime/vfs-browser-session-manager.js';
import type { VfsCredentialsProvider } from './credentials/vfs-credentials-provider.js';
import type { VfsAdapterConfig } from './config/vfs-adapter-config.js';
import { parseVfsRouteProfile } from './config/vfs-route-profile.parser.js';
import { VfsPageClassifier, VfsPageType } from './detection/vfs-page-classifier.js';
import { HumanVerificationDetector } from './detection/human-verification.detector.js';
import { LoginPage } from './pages/login.page.js';
import { BookingHomePage } from './pages/booking-home.page.js';
import { AppointmentDetailsPage } from './pages/appointment-details.page.js';
import { ApplicantDetailsPage } from './pages/applicant-details.page.js';
import { SlotSelectionPage } from './pages/slot-selection.page.js';
import { PaymentPage } from './pages/payment.page.js';
import { ConfirmationPage } from './pages/confirmation.page.js';
import { mapRouteToSelection } from './mapping/vfs-route.mapper.js';
import { logSafeBrowserEvent } from './security/safe-browser-log.js';

export class VfsProviderAdapter implements VisaProviderAdapter {
  readonly adapterId = 'vfs-global';
  private readonly classifier = new VfsPageClassifier();
  private readonly humanDetector = new HumanVerificationDetector();

  constructor(
    private readonly sessionManager: VfsBrowserSessionManager,
    private readonly credentialsProvider: VfsCredentialsProvider,
    private readonly config: VfsAdapterConfig,
  ) {}

  async authenticate(context: ProviderContext): Promise<AuthenticateResult> {
    logSafeBrowserEvent('Adapter: authenticate starting', { caseId: context.caseId });

    if (!context.providerAccountId) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_ACCOUNT_MISSING',
        safeMessage: 'No provider account assigned to booking case for VFS authentication.',
      };
    }

    let credentials;
    try {
      credentials = await this.credentialsProvider.getCredentials(context.providerAccountId);
    } catch (err: any) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_CREDENTIALS_LOAD_FAILED',
        safeMessage: 'Failed to load provider credentials.',
      };
    }

    const routeProfile = parseVfsRouteProfile(context.providerRoute.configuration);
    const session = await this.sessionManager.getOrCreateSession(context.caseId);

    try {
      const entryUrl = routeProfile.entryUrl || 'https://visa.vfsglobal.com';
      await session.navigate(entryUrl);

      // Check human challenge before touching credentials
      const preChallenge = await this.humanDetector.detect(session.page);
      if (preChallenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: preChallenge.actionType ?? HumanActionType.CAPTCHA,
          resumeToStatus: BookingCaseStatus.AUTHENTICATING,
          safeMessage: 'Human challenge detected on login entry page.',
          checkpoint: {
            pageType: VfsPageType.LOGIN,
            currentPath: session.getSafeCurrentPath(),
          },
        };
      }

      // Perform login
      const loginPage = new LoginPage(session.page);
      await loginPage.login(credentials);

      // Check post-login human challenge
      const postChallenge = await this.humanDetector.detect(session.page);
      if (postChallenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: postChallenge.actionType ?? HumanActionType.OTP,
          resumeToStatus: BookingCaseStatus.AUTHENTICATING,
          safeMessage: 'Verification required following credentials submission.',
          checkpoint: {
            pageType: VfsPageType.HUMAN_VERIFICATION,
            currentPath: session.getSafeCurrentPath(),
          },
        };
      }

      return {
        kind: 'SUCCESS',
        data: {
          authenticated: true,
          sessionExpiry: new Date(Date.now() + this.config.sessionTtlMinutes * 60 * 1000).toISOString(),
        },
      };
    } catch (err: any) {
      logSafeBrowserEvent('Authentication error', { caseId: context.caseId, message: err.message });
      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'VFS_AUTH_NAVIGATION_FAILED',
        safeMessage: 'Navigation timeout or connection failure during authentication.',
      };
    }
  }

  async inspectRoute(context: ProviderContext): Promise<RouteInspectionResult> {
    logSafeBrowserEvent('Adapter: inspectRoute starting', { caseId: context.caseId });
    const session = this.sessionManager.getSession(context.caseId);
    if (!session) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_NO_ACTIVE_SESSION',
        safeMessage: 'No active browser session found for route inspection.',
      };
    }

    try {
      const challenge = await this.humanDetector.detect(session.page);
      if (challenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: challenge.actionType ?? HumanActionType.CAPTCHA,
          resumeToStatus: BookingCaseStatus.AUTHENTICATING,
          safeMessage: 'Human verification required during route inspection.',
        };
      }

      // Check if on Booking Home, navigate to appointment details
      const pageType = await this.classifier.classify(session.page);
      if (pageType === VfsPageType.BOOKING_HOME) {
        const homePage = new BookingHomePage(session.page);
        await homePage.startNewBooking();
      }

      // Fill route criteria
      const criteria = mapRouteToSelection(context.providerRoute);
      const apptPage = new AppointmentDetailsPage(session.page);
      await apptPage.selectRouteCriteria(criteria);

      return {
        kind: 'SUCCESS',
        data: {
          supported: true,
          bookingMode: context.providerRoute.bookingMode,
          resolvedCentre: context.providerRoute.applicationCentre,
          resolvedCategory: context.providerRoute.visaCategory,
          resolvedSubcategory: context.providerRoute.visaSubcategory,
        },
      };
    } catch (err: any) {
      logSafeBrowserEvent('Inspect route error', { caseId: context.caseId, message: err.message });
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_ROUTE_SELECTION_FAILED',
        safeMessage: 'Failed to inspect and verify route details on VFS.',
      };
    }
  }

  async checkAvailability(context: ProviderContext): Promise<AvailabilityResult> {
    logSafeBrowserEvent('Adapter: checkAvailability starting', { caseId: context.caseId });
    const session = this.sessionManager.getSession(context.caseId);
    if (!session) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_NO_ACTIVE_SESSION',
        safeMessage: 'No active browser session found for availability check.',
      };
    }

    try {
      const challenge = await this.humanDetector.detect(session.page);
      if (challenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: challenge.actionType ?? HumanActionType.CAPTCHA,
          resumeToStatus: BookingCaseStatus.MONITORING,
          safeMessage: 'Human verification required during availability check.',
        };
      }

      const slotPage = new SlotSelectionPage(session.page);
      return await slotPage.checkAvailability(
        context.applicantCount,
        context.providerRoute.applicationCentre,
      );
    } catch (err: any) {
      logSafeBrowserEvent('Check availability error', { caseId: context.caseId, message: err.message });
      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'VFS_AVAILABILITY_CHECK_FAILED',
        safeMessage: 'Temporary error during availability check.',
      };
    }
  }

  async beginBooking(context: ProviderContext, slot: SlotCandidate): Promise<BookingResult> {
    logSafeBrowserEvent('Adapter: beginBooking starting', { caseId: context.caseId, slotDate: slot.date });
    const session = this.sessionManager.getSession(context.caseId);
    if (!session) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_NO_ACTIVE_SESSION',
        safeMessage: 'No active browser session found for booking initialization.',
      };
    }

    try {
      const challenge = await this.humanDetector.detect(session.page);
      if (challenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: challenge.actionType ?? HumanActionType.CAPTCHA,
          resumeToStatus: BookingCaseStatus.BOOKING,
          safeMessage: 'Human verification required when beginning booking.',
        };
      }

      return {
        kind: 'SUCCESS',
        data: {
          bookingSessionId: `vfs_booking_${context.caseId}`,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      };
    } catch (err: any) {
      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'VFS_BEGIN_BOOKING_FAILED',
        safeMessage: err.message,
      };
    }
  }

  async addApplicants(
    context: ProviderContext,
    applicants: ProviderApplicantInput[],
  ): Promise<ApplicantSubmissionResult> {
    logSafeBrowserEvent('Adapter: addApplicants starting', { caseId: context.caseId, count: applicants.length });
    const session = this.sessionManager.getSession(context.caseId);
    if (!session) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_NO_ACTIVE_SESSION',
        safeMessage: 'No active browser session found for adding applicants.',
      };
    }

    try {
      const challenge = await this.humanDetector.detect(session.page);
      if (challenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: challenge.actionType ?? HumanActionType.CAPTCHA,
          resumeToStatus: BookingCaseStatus.ADDING_APPLICANTS,
          safeMessage: 'Human verification required when adding applicants.',
        };
      }

      const applicantPage = new ApplicantDetailsPage(session.page);
      await applicantPage.addApplicants(applicants);

      return {
        kind: 'SUCCESS',
        data: {
          submittedApplicantCount: applicants.length,
        },
      };
    } catch (err: any) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_APPLICANTS_ENTRY_FAILED',
        safeMessage: 'Failed to fill applicant details on VFS form.',
      };
    }
  }

  async selectAppointment(
    context: ProviderContext,
    slot: SlotCandidate,
  ): Promise<AppointmentSelectionResult> {
    logSafeBrowserEvent('Adapter: selectAppointment starting', { caseId: context.caseId, slotDate: slot.date });
    const session = this.sessionManager.getSession(context.caseId);
    if (!session) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_NO_ACTIVE_SESSION',
        safeMessage: 'No active browser session found for appointment selection.',
      };
    }

    try {
      const challenge = await this.humanDetector.detect(session.page);
      if (challenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: challenge.actionType ?? HumanActionType.CAPTCHA,
          resumeToStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
          safeMessage: 'Human verification required during slot selection.',
        };
      }

      const slotPage = new SlotSelectionPage(session.page);
      const selected = await slotPage.selectSlot(slot);

      if (!selected) {
        return {
          kind: 'SUCCESS',
          data: {
            selected: false,
            slotLost: true,
          },
        };
      }

      return {
        kind: 'SUCCESS',
        data: {
          selected: true,
          slot,
        },
      };
    } catch (err: any) {
      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'VFS_SLOT_SELECTION_FAILED',
        safeMessage: err.message,
      };
    }
  }

  async getPaymentState(context: ProviderContext): Promise<PaymentStateResult> {
    logSafeBrowserEvent('Adapter: getPaymentState starting', { caseId: context.caseId });
    const session = this.sessionManager.getSession(context.caseId);
    if (!session) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_NO_ACTIVE_SESSION',
        safeMessage: 'No active browser session found for payment inspection.',
      };
    }

    try {
      const challenge = await this.humanDetector.detect(session.page);
      if (challenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: challenge.actionType ?? HumanActionType.OTP,
          resumeToStatus: BookingCaseStatus.PAYMENT_REQUIRED,
          safeMessage: 'Human verification required at payment step.',
        };
      }

      const paymentPage = new PaymentPage(session.page);
      const paymentInfo = await paymentPage.getPaymentDetails();

      if (paymentInfo.isPaymentPage) {
        return {
          kind: 'SUCCESS',
          data: {
            status: 'REQUIRED',
            amount: paymentInfo.amount,
            currency: paymentInfo.currency,
            externalReference: paymentInfo.externalReference,
            deadlineAt: paymentInfo.deadlineMinutes
              ? new Date(Date.now() + paymentInfo.deadlineMinutes * 60 * 1000).toISOString()
              : undefined,
          },
        };
      }

      // Check if confirmation is already visible
      const confirmationPage = new ConfirmationPage(session.page);
      const confirmInfo = await confirmationPage.getConfirmationDetails();
      if (confirmInfo.isConfirmed) {
        return {
          kind: 'SUCCESS',
          data: {
            status: 'PAID',
          },
        };
      }

      return {
        kind: 'SUCCESS',
        data: {
          status: 'PROCESSING',
        },
      };
    } catch (err: any) {
      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'VFS_PAYMENT_INSPECTION_FAILED',
        safeMessage: err.message,
      };
    }
  }

  async getConfirmation(context: ProviderContext): Promise<ConfirmationResult> {
    logSafeBrowserEvent('Adapter: getConfirmation starting', { caseId: context.caseId });
    const session = this.sessionManager.getSession(context.caseId);
    if (!session) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_NO_ACTIVE_SESSION',
        safeMessage: 'No active browser session found for confirmation check.',
      };
    }

    try {
      const confirmationPage = new ConfirmationPage(session.page);
      const confirmInfo = await confirmationPage.getConfirmationDetails();

      if (confirmInfo.isConfirmed) {
        return {
          kind: 'SUCCESS',
          data: {
            confirmed: true,
            bookingReference: confirmInfo.bookingReference,
            appointmentDate: confirmInfo.appointmentDate,
            centre: confirmInfo.centre,
          },
        };
      }

      return {
        kind: 'SUCCESS',
        data: {
          confirmed: false,
        },
      };
    } catch (err: any) {
      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'VFS_CONFIRMATION_CHECK_FAILED',
        safeMessage: err.message,
      };
    }
  }

  async resume(context: ProviderContext): Promise<ResumeResult> {
    logSafeBrowserEvent('Adapter: resume starting', { caseId: context.caseId });
    const session = this.sessionManager.getSession(context.caseId);
    if (!session) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_NO_ACTIVE_SESSION',
        safeMessage: 'No active browser session found for resume.',
      };
    }

    try {
      // Re-check challenge on the page
      const challenge = await this.humanDetector.detect(session.page);
      if (challenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: challenge.actionType ?? HumanActionType.CAPTCHA,
          resumeToStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
          safeMessage: 'Human challenge still present on page.',
        };
      }

      return {
        kind: 'SUCCESS',
        data: {
          resumed: true,
        },
      };
    } catch (err: any) {
      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'VFS_RESUME_FAILED',
        safeMessage: err.message,
      };
    }
  }
}

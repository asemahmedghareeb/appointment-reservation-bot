import {
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
import { BookingCaseStatus } from '@visaflow/shared-types';
import type { VfsBrowserSessionManager } from './runtime/vfs-browser-session-manager.js';
import type { VfsBrowserSession } from './runtime/vfs-browser-session.js';
import type { VfsCredentialsProvider } from './credentials/vfs-credentials-provider.js';
import type { VfsAdapterConfig } from './config/vfs-adapter-config.js';
import { parseVfsRouteProfile } from './config/vfs-route-profile.parser.js';
import { VfsCapabilityResolver } from './capabilities/vfs-capability.resolver.js';
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
import { isOriginAllowed } from './security/safe-url.js';
import * as fs from 'fs';
import * as path from 'path';

export class VfsProviderAdapter implements VisaProviderAdapter {
  readonly adapterId = 'vfs-global';
  private readonly classifier = new VfsPageClassifier();
  private readonly humanDetector = new HumanVerificationDetector();
  private readonly capabilityResolver = new VfsCapabilityResolver();

  constructor(
    private readonly sessionManager: VfsBrowserSessionManager,
    private readonly credentialsProvider: VfsCredentialsProvider,
    private readonly config: VfsAdapterConfig,
  ) {}

  async isSessionAuthenticated(caseId: string): Promise<boolean> {
    const session = this.sessionManager.getSession(caseId);
    if (!session || session.page.isClosed()) {
      return false;
    }

    try {
      const url = session.page.url();
      if (!url || url === 'about:blank') return false;

      // Cannot be on login or error pages
      if (url.includes('/login') || url.includes('page-not-found') || url.includes('session-expired')) {
        return false;
      }

      // 1. URL-based detection: /dashboard or /application-detail
      const isDashboardUrl = url.includes('/dashboard') || url.includes('/application-detail');

      // 2. DOM-based detection: presence of Start New Booking, Logout, or account elements
      const isDashboardDom = await session.page.locator(
        'button:has-text("Start New Booking"), a:has-text("Start New Booking"), button:has-text("حجز موعد جديد"), a:has-text("حجز موعد جديد"), button:has-text("Book now"), a:has-text("Book now"), a:has-text("Sign out"), button:has-text("Sign out"), a:has-text("Logout"), button:has-text("Logout")'
      ).first().isVisible().catch(() => false);

      return isDashboardUrl || isDashboardDom;
    } catch {
      return false;
    }
  }

  async prepareLoginSession(context: ProviderContext): Promise<VfsBrowserSession> {
    logSafeBrowserEvent('Adapter: prepareLoginSession starting', { caseId: context.caseId });

    let routeProfile;
    try {
      routeProfile = parseVfsRouteProfile(context.providerRoute.configuration, {
        sourceCountry: context.providerRoute.sourceCountry,
        destinationCountry: context.providerRoute.destinationCountry,
      });
    } catch (err: any) {
      throw new Error(`Failed to parse VFS route profile: ${err.message}`);
    }

    if (!routeProfile.entryUrl || !isOriginAllowed(routeProfile.entryUrl, this.config.allowedOrigins)) {
      throw new Error(`Route entry URL origin is not allowed: ${routeProfile.entryUrl}`);
    }

    const authUrl = routeProfile.entryUrl.includes('/application-detail')
      ? routeProfile.entryUrl.replace('/application-detail', '/login')
      : routeProfile.entryUrl;

    const session = await this.sessionManager.getOrCreateSession(context.caseId);

    // Warm up landing page if distinct from authUrl
    const landingUrl = authUrl.replace(/\/login.*$/, '');
    if (landingUrl !== authUrl && !authUrl.includes('127.0.0.1')) {
      logSafeBrowserEvent('Warming up session via landing page', { caseId: context.caseId, landingUrl });
      await session.navigate(landingUrl).catch(() => {});
      await session.page.waitForTimeout(2000);
    }

    logSafeBrowserEvent('Navigating to VFS login entry URL for manual operator login', {
      caseId: context.caseId,
      authUrl,
    });
    await session.navigate(authUrl);

    // Dismiss cookie banner if it appears
    try {
      const cookieBtn = session.page.locator(
        '#onetrust-accept-btn-handler, button:has-text("Accept All Cookies"), button:has-text("Accept All")'
      ).first();
      if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cookieBtn.click({ force: true }).catch(() => {});
      }
    } catch {}

    return session;
  }

  async authenticate(context: ProviderContext): Promise<AuthenticateResult> {
    logSafeBrowserEvent('Adapter: authenticate starting', { caseId: context.caseId });

    // 1. Verify if an existing session is already authenticated via manual login
    const existingSession = this.sessionManager.getSession(context.caseId);
    if (existingSession) {
      const isAuth = await this.isSessionAuthenticated(context.caseId);
      if (isAuth) {
        logSafeBrowserEvent('Existing session is already authenticated via manual login!', { caseId: context.caseId });
        return {
          kind: 'SUCCESS',
          data: {
            authenticatedAt: new Date().toISOString(),
            sessionId: existingSession.caseId,
          },
        };
      }
    }

    let routeProfile;
    try {
      routeProfile = parseVfsRouteProfile(context.providerRoute.configuration, {
        sourceCountry: context.providerRoute.sourceCountry,
        destinationCountry: context.providerRoute.destinationCountry,
      });
    } catch (err: any) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_INVALID_ROUTE_PROFILE',
        safeMessage: `Failed to parse VFS route profile: ${err.message}`,
      };
    }

    if (!routeProfile.entryUrl || !isOriginAllowed(routeProfile.entryUrl, this.config.allowedOrigins)) {
      return {
        kind: 'PERMANENT_FAILURE',
        code: 'VFS_ORIGIN_NOT_ALLOWED',
        safeMessage: `Route entry URL origin is not in approved VFS allowed origins list: ${routeProfile.entryUrl}`,
      };
    }

    const isTestServer = routeProfile.entryUrl.includes('127.0.0.1') || routeProfile.entryUrl.includes('localhost');

    // 2. In live automation: strictly enforce manual login boundary (never auto-type credentials)
    if (!isTestServer) {
      let session = existingSession;
      if (!session) {
        session = await this.prepareLoginSession(context);
      }

      return {
        kind: 'HUMAN_ACTION_REQUIRED',
        action: HumanActionType.MANUAL_VERIFICATION,
        resumeToStatus: BookingCaseStatus.AUTHENTICATING,
        safeMessage: 'تسجيل الدخول مطلوب. يرجى تسجيل الدخول إلى حساب VFS أولاً قبل تشغيل البوت.',
        checkpoint: {
          pageType: VfsPageType.LOGIN,
          currentPath: session ? session.getSafeCurrentPath() : '/login',
        },
      };
    }

    // 3. Synthetic test server compatibility fallback
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
        code: 'VFS_CREDENTIAL_LOAD_FAILED',
        safeMessage: 'Failed to load provider credentials.',
      };
    }

    const session = await this.sessionManager.getOrCreateSession(context.caseId);
    try {
      const authUrl = routeProfile.entryUrl;
      await session.navigate(authUrl);

      const preChallenge = await this.humanDetector.detect(session.page);
      if (preChallenge.detected) {
        return {
          kind: 'HUMAN_ACTION_REQUIRED',
          action: preChallenge.actionType ?? HumanActionType.CAPTCHA,
          resumeToStatus: BookingCaseStatus.AUTHENTICATING,
          safeMessage: 'Verification required before credentials submission.',
          checkpoint: {
            pageType: VfsPageType.HUMAN_VERIFICATION,
            currentPath: session.getSafeCurrentPath(),
          },
        };
      }

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
          authenticatedAt: new Date().toISOString(),
          sessionId: session.caseId,
        },
      };
    } catch (err: any) {
      try {
        const challengeOnErr = await this.humanDetector.detect(session.page);
        if (challengeOnErr.detected) {
          return {
            kind: 'HUMAN_ACTION_REQUIRED',
            action: challengeOnErr.actionType ?? HumanActionType.MANUAL_VERIFICATION,
            resumeToStatus: BookingCaseStatus.AUTHENTICATING,
            safeMessage: challengeOnErr.details || 'Human verification or security block detected during authentication.',
            checkpoint: {
              pageType: VfsPageType.LOGIN,
              currentPath: session.getSafeCurrentPath(),
            },
          };
        }
      } catch {}

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
          routeSupported: true,
          bookingMode: context.providerRoute.bookingMode,
          metadata: {
            resolvedCentre: context.providerRoute.applicationCentre,
            resolvedCategory: context.providerRoute.visaCategory,
            resolvedSubcategory: context.providerRoute.visaSubcategory,
          },
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

      const routeProfile = parseVfsRouteProfile(context.providerRoute.configuration, {
        sourceCountry: context.providerRoute.sourceCountry,
        destinationCountry: context.providerRoute.destinationCountry,
      });
      const capabilities = this.capabilityResolver.resolve(routeProfile);

      if (!capabilities.supportsGroupBooking && context.applicantCount > 1) {
        return {
          kind: 'SUCCESS',
          data: {
            outcome: 'GROUP_CAPACITY_MISMATCH',
            requestedApplicants: context.applicantCount,
            maximumAvailableApplicants: 1,
          },
        };
      }

      if (capabilities.maxApplicants && context.applicantCount > capabilities.maxApplicants) {
        return {
          kind: 'SUCCESS',
          data: {
            outcome: 'GROUP_CAPACITY_MISMATCH',
            requestedApplicants: context.applicantCount,
            maximumAvailableApplicants: capabilities.maxApplicants,
          },
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
          outcome: 'STARTED',
          bookingSessionId: `vfs_booking_${context.caseId}`,
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
          submittedCount: applicants.length,
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
          kind: 'RETRYABLE_FAILURE',
          code: 'SLOT_LOST',
          safeMessage: 'Appointment slot is no longer available.',
        };
      }

      return {
        kind: 'SUCCESS',
        data: {
          selectedSlot: slot,
          selectedAt: new Date().toISOString(),
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

      if (session.page.url().includes('payment')) {
        await session.page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
      }

      const paymentPage = new PaymentPage(session.page);
      const paymentInfo = await paymentPage.getPaymentDetails();


      if (paymentInfo.isPaymentPage) {
        const parsedAmount = paymentInfo.amount ? Number(paymentInfo.amount) : undefined;
        return {
          kind: 'SUCCESS',
          data: {
            paymentState: 'REQUIRED',
            currency: paymentInfo.currency ?? 'EUR',
            ...(parsedAmount !== undefined ? { amount: parsedAmount } : {}),
            ...(paymentInfo.externalReference ? { reference: paymentInfo.externalReference } : {}),
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
            paymentState: 'PAID',
          },
        };
      }

      return {
        kind: 'SUCCESS',
        data: {
          paymentState: 'PROCESSING',
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
            referenceNumber: confirmInfo.bookingReference ?? 'CONFIRMED_REF',
            confirmedAt: new Date().toISOString(),
            appointmentDate: confirmInfo.appointmentDate ?? new Date().toISOString().slice(0, 10),
            ...(confirmInfo.centre ? { centre: confirmInfo.centre } : {}),
          },
        };
      }

      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'NOT_CONFIRMED',
        safeMessage: 'Booking confirmation not yet available.',
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
      await session.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

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
          resumedAt: new Date().toISOString(),
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

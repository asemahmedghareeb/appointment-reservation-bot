import { Injectable } from '@nestjs/common';
import type { FullBookingCase } from './booking-cases.repository.js';
import { BookingCaseStatus } from '@visaflow/shared-types';
import { BookingCaseNotDraftError } from './errors/booking-case-not-draft.error.js';
import { BookingCaseNotReadyError } from './errors/booking-case-not-ready.error.js';
import { ProviderRouteDisabledError } from '../provider-routes/errors/provider-route-disabled.error.js';
import { PassportValidationService } from '../applicants/passport-validation.service.js';
import type { ProviderRouteConfig } from '@visaflow/shared-types';

@Injectable()
export class CaseReadinessService {
  constructor(private readonly passportValidationService: PassportValidationService) {}

  /**
   * Evaluates all 10 readiness rules.
   * Throws structured domain error if any rule is violated.
   */
  validateCaseReadiness(bookingCase: FullBookingCase): void {
    const caseId = bookingCase.id;

    // Rule 2: Current status must be DRAFT
    if (bookingCase.status !== BookingCaseStatus.DRAFT) {
      throw new BookingCaseNotDraftError(caseId, bookingCase.status);
    }

    // Rule 3: ProviderRoute exists and is enabled
    const route = bookingCase.providerRoute;
    if (!route || !route.enabled) {
      throw new ProviderRouteDisabledError(bookingCase.providerRouteId);
    }

    const applicants = bookingCase.bookingApplicants;

    // Rule 4: At least one BookingApplicant exists
    if (!applicants || applicants.length === 0) {
      throw new BookingCaseNotReadyError(
        caseId,
        'minimum_applicants',
        'At least one applicant must be attached to the booking case before marking it READY.',
      );
    }

    // Rule 5: Exactly one BookingApplicant is primary
    const primaryApplicants = applicants.filter((a) => a.isPrimary);
    if (primaryApplicants.length === 0) {
      throw new BookingCaseNotReadyError(
        caseId,
        'missing_primary_applicant',
        'The booking case must have exactly one primary applicant designated.',
      );
    }
    if (primaryApplicants.length > 1) {
      throw new BookingCaseNotReadyError(
        caseId,
        'multiple_primary_applicants',
        'The booking case has multiple primary applicants designated (only one primary is permitted).',
      );
    }

    // Rule 6: Applicant positions are valid, unique, and contiguous 1..N
    const positions = applicants.map((a) => a.position).sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i++) {
      const expectedPosition = i + 1;
      if (positions[i] !== expectedPosition) {
        throw new BookingCaseNotReadyError(
          caseId,
          'invalid_position_ordering',
          `Applicant positions must be contiguous 1..N without gaps or duplicates. Expected position ${expectedPosition} but found ${positions[i]}.`,
        );
      }
    }

    // Rule 7: Every referenced Applicant still exists
    for (const ba of applicants) {
      if (!ba.applicant) {
        throw new BookingCaseNotReadyError(
          caseId,
          'missing_applicant_record',
          `Referenced applicant record '${ba.applicantId}' could not be loaded.`,
        );
      }
    }

    // Rule 8: Every Applicant's passport satisfies route-configured expiry rules
    for (const ba of applicants) {
      this.passportValidationService.validateForRoute({
        applicantId: ba.applicantId,
        passportExpiry: ba.applicant.passportExpiry,
        providerRoute: route,
        preferredDateFrom: bookingCase.preferredDateFrom,
        preferredDateTo: bookingCase.preferredDateTo,
      });
    }

    // Route configuration rules
    const routeConfig = (route.configurationJson as ProviderRouteConfig | null) || {};
    const groupRules = routeConfig.groupRules;

    if (groupRules) {
      // Rule 9: minimumApplicants and maximumApplicants validation
      if (
        groupRules.minimumApplicants !== undefined &&
        applicants.length < groupRules.minimumApplicants
      ) {
        throw new BookingCaseNotReadyError(
          caseId,
          'route_minimum_applicants',
          `This provider route requires a minimum of ${groupRules.minimumApplicants} applicant(s). Current count: ${applicants.length}.`,
        );
      }

      if (
        groupRules.maximumApplicants !== undefined &&
        applicants.length > groupRules.maximumApplicants
      ) {
        throw new BookingCaseNotReadyError(
          caseId,
          'route_maximum_applicants',
          `This provider route allows a maximum of ${groupRules.maximumApplicants} applicant(s). Current count: ${applicants.length}.`,
        );
      }

      // Rule 10: allowGroupSplit conflict validation
      if (bookingCase.allowGroupSplit && groupRules.allowSplit === false) {
        throw new BookingCaseNotReadyError(
          caseId,
          'group_split_forbidden',
          'This case requested allowGroupSplit, but the provider route strictly forbids group splitting.',
        );
      }
    }
  }

  /**
   * Phase 1 Status Transition Guard (Section 43 & Section 67):
   * Strictly allows only DRAFT -> READY.
   * All other transitions are rejected in Phase 1.
   */
  assertValidTransition(fromStatus: BookingCaseStatus, toStatus: BookingCaseStatus): void {
    if (fromStatus === BookingCaseStatus.DRAFT && toStatus === BookingCaseStatus.READY) {
      return;
    }
    throw new BookingCaseNotDraftError(
      'transition',
      fromStatus,
    );
  }
}


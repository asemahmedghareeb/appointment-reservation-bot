import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CaseReadinessService } from '../case-readiness.service.js';
import { PassportValidationService } from '../../applicants/passport-validation.service.js';
import { BookingCaseNotDraftError } from '../errors/booking-case-not-draft.error.js';
import { BookingCaseNotReadyError } from '../errors/booking-case-not-ready.error.js';
import { ProviderRouteDisabledError } from '../../provider-routes/errors/provider-route-disabled.error.js';
import { InvalidPassportExpiryError } from '../../applicants/errors/invalid-passport-expiry.error.js';
import {
  BookingCaseStatus,
  BookingMode,
  Gender,
  ApplicantRelation,
} from '@visaflow/shared-types';
import type { FullBookingCase } from '../booking-cases.repository.js';

describe('CaseReadinessService', () => {
  let service: CaseReadinessService;
  let passportValidationService: Partial<PassportValidationService>;

  const validApplicant = {
    id: 'app_1',
    clientId: null,
    firstName: 'Sara',
    lastName: 'Adel',
    gender: Gender.FEMALE,
    dateOfBirth: new Date('1998-04-12'),
    nationality: 'EG',
    phone: null,
    email: null,
    passportNumberEncrypted: 'v1.iv.tag.ct',
    passportNumberHash: 'hash_1',
    passportExpiry: new Date('2032-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockCase = (overrides?: Partial<FullBookingCase>): FullBookingCase => ({
    id: 'case_1',
    caseNumber: 'VF_123',
    providerRouteId: 'route_1',
    status: BookingCaseStatus.DRAFT,
    bookingMode: BookingMode.APPOINTMENT_CALENDAR,
    preferredDateFrom: new Date('2026-11-01'),
    preferredDateTo: new Date('2026-11-30'),
    preferredTime: null,
    allowGroupSplit: false,
    createdById: 'user_1',
    providerAccountId: null,
    createdAt: new Date(),
    updatedAt: new Date(),

    providerRoute: {
      id: 'route_1',
      providerId: 'prov_1',
      provider: { code: 'VFS', name: 'VFS Global' },
      sourceCountry: 'EG',
      destinationCountry: 'FR',
      applicationCentre: 'Cairo',
      visaCategory: 'TOURISM',
      visaSubcategory: 'SHORT_STAY',
      bookingMode: BookingMode.APPOINTMENT_CALENDAR,
      enabled: true,
      configurationJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    bookingApplicants: [
      {
        id: 'ba_1',
        bookingCaseId: 'case_1',
        applicantId: 'app_1',
        position: 1,
        relation: ApplicantRelation.PRIMARY,
        isPrimary: true,
        createdAt: new Date(),
        applicant: validApplicant,
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    passportValidationService = {
      validateForRoute: vi.fn(),
    };

    service = new CaseReadinessService(
      passportValidationService as PassportValidationService,
    );
  });

  it('passes validation when all 10 readiness rules are satisfied', () => {
    const validCase = createMockCase();
    expect(() => service.validateCaseReadiness(validCase)).not.toThrow();
  });

  it('fails when case is not in DRAFT status', () => {
    const caseInReady = createMockCase({ status: BookingCaseStatus.READY });
    expect(() => service.validateCaseReadiness(caseInReady)).toThrow(BookingCaseNotDraftError);
  });

  it('fails when providerRoute is disabled', () => {
    const caseWithDisabledRoute = createMockCase({
      providerRoute: {
        ...createMockCase().providerRoute,
        enabled: false,
      },
    });
    expect(() => service.validateCaseReadiness(caseWithDisabledRoute)).toThrow(
      ProviderRouteDisabledError,
    );
  });

  it('fails when case has zero applicants', () => {
    const caseNoApplicants = createMockCase({ bookingApplicants: [] });
    expect(() => service.validateCaseReadiness(caseNoApplicants)).toThrow(BookingCaseNotReadyError);
  });

  it('fails when case has no primary applicant', () => {
    const caseNoPrimary = createMockCase({
      bookingApplicants: [
        {
          ...createMockCase().bookingApplicants[0]!,
          isPrimary: false,
        },
      ],
    });
    expect(() => service.validateCaseReadiness(caseNoPrimary)).toThrow(BookingCaseNotReadyError);
  });

  it('fails when case has multiple primary applicants', () => {
    const caseTwoPrimaries = createMockCase({
      bookingApplicants: [
        {
          ...createMockCase().bookingApplicants[0]!,
          id: 'ba_1',
          position: 1,
          isPrimary: true,
        },
        {
          ...createMockCase().bookingApplicants[0]!,
          id: 'ba_2',
          position: 2,
          isPrimary: true,
        },
      ],
    });
    expect(() => service.validateCaseReadiness(caseTwoPrimaries)).toThrow(BookingCaseNotReadyError);
  });

  it('fails when applicant positions have gaps (non-contiguous)', () => {
    const caseGapPositions = createMockCase({
      bookingApplicants: [
        {
          ...createMockCase().bookingApplicants[0]!,
          id: 'ba_1',
          position: 1,
          isPrimary: true,
        },
        {
          ...createMockCase().bookingApplicants[0]!,
          id: 'ba_2',
          position: 3, // gap: expected 2
          isPrimary: false,
        },
      ],
    });
    expect(() => service.validateCaseReadiness(caseGapPositions)).toThrow(BookingCaseNotReadyError);
  });

  it('fails when applicant passport fails route validation', () => {
    vi.spyOn(passportValidationService as any, 'validateForRoute').mockImplementation(() => {
      throw new InvalidPassportExpiryError('app_1', 'minimumValidityDaysFromToday');
    });

    const validCase = createMockCase();
    expect(() => service.validateCaseReadiness(validCase)).toThrow(InvalidPassportExpiryError);
  });

  it('fails when applicant count is below route minimumApplicants', () => {
    const caseBelowMin = createMockCase({
      providerRoute: {
        ...createMockCase().providerRoute,
        configurationJson: {
          groupRules: { minimumApplicants: 2 },
        },
      },
      bookingApplicants: [createMockCase().bookingApplicants[0]!], // only 1
    });

    expect(() => service.validateCaseReadiness(caseBelowMin)).toThrow(BookingCaseNotReadyError);
  });

  it('fails when applicant count exceeds route maximumApplicants', () => {
    const caseAboveMax = createMockCase({
      providerRoute: {
        ...createMockCase().providerRoute,
        configurationJson: {
          groupRules: { maximumApplicants: 1 },
        },
      },
      bookingApplicants: [
        { ...createMockCase().bookingApplicants[0]!, id: 'ba_1', position: 1, isPrimary: true },
        { ...createMockCase().bookingApplicants[0]!, id: 'ba_2', position: 2, isPrimary: false },
      ],
    });

    expect(() => service.validateCaseReadiness(caseAboveMax)).toThrow(BookingCaseNotReadyError);
  });

  it('fails when allowGroupSplit is true but route explicitly forbids split', () => {
    const caseSplitForbidden = createMockCase({
      allowGroupSplit: true,
      providerRoute: {
        ...createMockCase().providerRoute,
        configurationJson: {
          groupRules: { allowSplit: false },
        },
      },
    });

    expect(() => service.validateCaseReadiness(caseSplitForbidden)).toThrow(
      BookingCaseNotReadyError,
    );
  });

  describe('Section 67: Status Transition Guard', () => {
    it('allows DRAFT -> READY transition', () => {
      expect(() =>
        service.assertValidTransition(BookingCaseStatus.DRAFT, BookingCaseStatus.READY),
      ).not.toThrow();
    });

    it('rejects READY -> READY transition', () => {
      expect(() =>
        service.assertValidTransition(BookingCaseStatus.READY, BookingCaseStatus.READY),
      ).toThrow(BookingCaseNotDraftError);
    });

    it('rejects READY -> AUTHENTICATING transition', () => {
      expect(() =>
        service.assertValidTransition(BookingCaseStatus.READY, BookingCaseStatus.AUTHENTICATING),
      ).toThrow(BookingCaseNotDraftError);
    });

    it('rejects DRAFT -> MONITORING transition', () => {
      expect(() =>
        service.assertValidTransition(BookingCaseStatus.DRAFT, BookingCaseStatus.MONITORING),
      ).toThrow(BookingCaseNotDraftError);
    });

    it('rejects DRAFT -> CONFIRMED transition', () => {
      expect(() =>
        service.assertValidTransition(BookingCaseStatus.DRAFT, BookingCaseStatus.CONFIRMED),
      ).toThrow(BookingCaseNotDraftError);
    });
  });
});


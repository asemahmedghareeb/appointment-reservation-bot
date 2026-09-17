import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingCasesService } from '../booking-cases.service.js';
import { BookingCasesRepository, type FullBookingCase } from '../booking-cases.repository.js';
import { ProviderRoutesRepository } from '../../provider-routes/provider-routes.repository.js';
import { ApplicantsRepository } from '../../applicants/applicants.repository.js';
import { CaseNumberService } from '../case-number.service.js';
import { CaseReadinessService } from '../case-readiness.service.js';
import { CurrentUserService } from '../../../common/context/current-user.service.js';
import { BookingCaseNotDraftError } from '../errors/booking-case-not-draft.error.js';
import { ApplicantAlreadyLinkedError } from '../errors/applicant-already-linked.error.js';
import { InvalidApplicantPositionError } from '../errors/invalid-applicant-position.error.js';
import {
  BookingCaseStatus,
  BookingMode,
  AppointmentSelectionMode,
  Gender,
  ApplicantRelation,
  UserRole,
} from '@visaflow/shared-types';

describe('BookingCasesService', () => {
  let service: BookingCasesService;
  let casesRepo: Partial<BookingCasesRepository>;
  let routesRepo: Partial<ProviderRoutesRepository>;
  let applicantsRepo: Partial<ApplicantsRepository>;
  let readinessService: Partial<CaseReadinessService>;

  const mockRoute = {
    id: 'route_1',
    providerId: 'prov_1',
    provider: { code: 'VFS' as any, name: 'VFS Global' },
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
  };

  const mockApplicant = {
    id: 'app_1',
    clientId: null,
    firstName: 'Sara',
    lastName: 'Adel',
    gender: Gender.FEMALE,
    dateOfBirth: new Date('1998-04-12'),
    nationality: 'EG',
    phone: null,
    phoneCountryCode: null,
    phoneNumber: null,
    email: null,
    passportNumberEncrypted: 'v1.iv.tag.ct',
    passportNumberHash: 'hash_1',
    passportExpiry: new Date('2032-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCase: FullBookingCase = {
    id: 'case_1',
    caseNumber: 'VF_123456_ABC',
    providerRouteId: 'route_1',
    status: BookingCaseStatus.DRAFT,
    bookingMode: BookingMode.APPOINTMENT_CALENDAR,
    appointmentSelectionMode: AppointmentSelectionMode.DATE_RANGE,
    preferredDateFrom: new Date('2026-11-01'),
    preferredDateTo: new Date('2026-11-30'),
    preferredDate: null,
    preferredTime: null,
    preferredTimeFrom: null,
    preferredTimeTo: null,
    acceptAnyAvailableTime: true,
    appointmentType: 'STANDARD',
    servicesJson: null,
    providerTermsAccepted: true,
    termsAcceptedAt: new Date(),
    marketingConsent: false,
    marketingConsentAt: null,
    providerServiceFee: null,
    optionalServicesTotal: null,
    additionalFees: null,
    totalAmount: null,
    currency: 'EGP',
    feeCapturedAt: null,
    allowGroupSplit: false,
    createdById: 'user_1',
    providerAccountId: null,
    createdAt: new Date(),
    updatedAt: new Date(),

    providerRoute: mockRoute,
    bookingApplicants: [
      {
        id: 'ba_1',
        bookingCaseId: 'case_1',
        applicantId: 'app_1',
        position: 1,
        relation: ApplicantRelation.PRIMARY,
        isPrimary: true,
        createdAt: new Date(),
        applicant: mockApplicant,
      },
    ],
  };

  beforeEach(() => {
    casesRepo = {
      create: vi.fn().mockResolvedValue(mockCase),
      findById: vi.fn().mockResolvedValue(mockCase),
      findMany: vi.fn().mockResolvedValue([mockCase]),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(mockCase),
      findApplicantLink: vi.fn().mockResolvedValue(null),
      addApplicant: vi.fn().mockResolvedValue(mockCase.bookingApplicants[0]!),
      setPrimaryApplicant: vi.fn().mockResolvedValue(undefined),
      reorderApplicants: vi.fn().mockResolvedValue(undefined),
      removeApplicant: vi.fn().mockResolvedValue(mockCase.bookingApplicants[0]!),
      transitionToReady: vi.fn().mockResolvedValue({
        ...mockCase,
        status: BookingCaseStatus.READY,
      }),
    };

    routesRepo = {
      findById: vi.fn().mockResolvedValue(mockRoute),
    };

    applicantsRepo = {
      findById: vi.fn().mockResolvedValue(mockApplicant),
    };

    readinessService = {
      validateCaseReadiness: vi.fn(),
    };

    const caseNumberService = {
      generate: vi.fn().mockReturnValue('VF_123456_ABC'),
    };

    const currentUserService = {
      getActor: vi.fn().mockResolvedValue({
        id: 'user_1',
        name: 'Agent Tarek',
        email: 'agent@visaflow.com',
        role: UserRole.BOOKING_AGENT,
      }),
    };

    service = new BookingCasesService(
      casesRepo as BookingCasesRepository,
      routesRepo as ProviderRoutesRepository,
      applicantsRepo as ApplicantsRepository,
      caseNumberService as CaseNumberService,
      readinessService as CaseReadinessService,
      currentUserService as unknown as CurrentUserService,
    );
  });

  it('Test A & B: creates new case in DRAFT status and copies bookingMode from ProviderRoute', async () => {
    const res = await service.create({
      providerRouteId: 'route_1',
      preferredDateFrom: '2026-11-01',
      preferredDateTo: '2026-11-30',
    });

    expect(casesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BookingCaseStatus.DRAFT,
        bookingMode: BookingMode.APPOINTMENT_CALENDAR,
        caseNumber: 'VF_123456_ABC',
      }),
    );
    expect(res.status).toBe(BookingCaseStatus.DRAFT);
    expect(res.bookingMode).toBe(BookingMode.APPOINTMENT_CALENDAR);
  });

  it('Test C: cannot link same applicant twice', async () => {
    vi.spyOn(casesRepo as any, 'findApplicantLink').mockResolvedValue({
      id: 'ba_1',
      bookingCaseId: 'case_1',
      applicantId: 'app_1',
      position: 1,
      relation: ApplicantRelation.PRIMARY,
      isPrimary: true,
      createdAt: new Date(),
    });

    await expect(
      service.addApplicant('case_1', {
        applicantId: 'app_1',
        relation: ApplicantRelation.PRIMARY,
      }),
    ).rejects.toThrow(ApplicantAlreadyLinkedError);
  });

  it('Test D: cannot assign duplicate positions within the same case', async () => {
    await expect(
      service.addApplicant('case_1', {
        applicantId: 'app_2',
        relation: ApplicantRelation.SPOUSE,
        position: 1, // position 1 is already taken by ba_1
      }),
    ).rejects.toThrow(InvalidApplicantPositionError);
  });

  it('Test E: setting new primary applicant calls repository atomic primary update', async () => {
    await service.setPrimaryApplicant('case_1', 'ba_1');

    expect(casesRepo.setPrimaryApplicant).toHaveBeenCalledWith('case_1', 'ba_1');
  });

  it('Test F: reordering applicants validates entire set and updates atomically', async () => {
    await service.reorderApplicants('case_1', {
      items: [{ bookingApplicantId: 'ba_1', position: 1 }],
    });

    expect(casesRepo.reorderApplicants).toHaveBeenCalledWith('case_1', [
      { bookingApplicantId: 'ba_1', position: 1 },
    ]);
  });

  it('Test G: removing applicant is rejected if case is not DRAFT', async () => {
    vi.spyOn(casesRepo as any, 'findById').mockResolvedValue({
      ...mockCase,
      status: BookingCaseStatus.READY,
    });

    await expect(service.removeApplicant('case_1', 'ba_1')).rejects.toThrow(
      BookingCaseNotDraftError,
    );
  });

  it('Test H: cannot update DRAFT-only fields after case is READY', async () => {
    vi.spyOn(casesRepo as any, 'findById').mockResolvedValue({
      ...mockCase,
      status: BookingCaseStatus.READY,
    });

    await expect(
      service.update('case_1', { preferredTime: 'AFTERNOON' }),
    ).rejects.toThrow(BookingCaseNotDraftError);
  });

  it('Test I: marks case READY via atomic transaction with state history and activity log', async () => {
    const res = await service.markReady('case_1', { reason: 'All checks passed' });

    expect(readinessService.validateCaseReadiness).toHaveBeenCalledWith(mockCase);
    expect(casesRepo.transitionToReady).toHaveBeenCalledWith({
      caseId: 'case_1',
      actorId: 'user_1',
      reason: 'All checks passed',
    });
    expect(res.status).toBe(BookingCaseStatus.READY);
  });
});

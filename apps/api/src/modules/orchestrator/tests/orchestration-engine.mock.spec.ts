import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BookingCaseStatus,
  BookingMode,
  ProviderCode,
  Gender,
  ApplicantRelation,
  StateActorType,
} from '@visaflow/database';
import {
  MockProviderAdapter,
  MockScenario,
} from '@visaflow/provider-core';
import { OrchestrationEngineService } from '../services/orchestration-engine.service.js';
import { OrchestratorRepository } from '../repositories/orchestrator.repository.js';
import { CaseTransitionService } from '../services/case-transition.service.js';
import { CaseLockService } from '../infrastructure/locks/case-lock.service.js';
import { ProviderAdapterResolver } from '../services/provider-adapter-resolver.service.js';
import { IdempotencyGuardService } from '../services/idempotency-guard.service.js';

describe('OrchestrationEngineService with MockProviderAdapter', () => {
  let engine: OrchestrationEngineService;
  let repo: any;
  let transitionService: CaseTransitionService;
  let lockService: CaseLockService;
  let resolver: ProviderAdapterResolver;
  let guard: IdempotencyGuardService;
  let mockAdapter: MockProviderAdapter;

  let currentCase: any;

  beforeEach(() => {
    mockAdapter = new MockProviderAdapter();

    currentCase = {
      id: 'case_orch_1',
      caseNumber: 'VF_CASE_1',
      status: BookingCaseStatus.READY,
      bookingMode: BookingMode.APPOINTMENT_CALENDAR,
      preferredDateFrom: new Date('2026-11-15'),
      preferredDateTo: new Date('2026-11-25'),
      allowGroupSplit: false,
      providerRoute: {
        id: 'route_1',
        sourceCountry: 'EG',
        destinationCountry: 'FR',
        applicationCentre: 'Cairo',
        visaCategory: 'TOURISM',
        visaSubcategory: 'SHORT_STAY',
        bookingMode: BookingMode.APPOINTMENT_CALENDAR,
        enabled: true,
        configurationJson: {},
        provider: {
          code: ProviderCode.VFS,
          name: 'VFS Global',
        },
      },
      bookingApplicants: [
        {
          id: 'ba_1',
          position: 1,
          relation: ApplicantRelation.PRIMARY,
          isPrimary: true,
          applicant: {
            id: 'app_1',
            firstName: 'Tarek',
            lastName: 'Omar',
            gender: Gender.MALE,
            dateOfBirth: new Date('1990-01-01'),
            nationality: 'EG',
            passportNumberEncrypted: 'v1.iv.tag.ct',
            passportNumberHash: 'hash_1',
            passportExpiry: new Date('2032-01-01'),
            phone: '+20100000000',
            email: 'tarek@example.com',
          },
        },
      ],
    };

    repo = {
      findCaseById: vi.fn().mockImplementation(async () => currentCase),
      getLatestStateHistory: vi.fn().mockResolvedValue(null),
      atomicStatusTransition: vi.fn().mockImplementation(async (params) => {
        currentCase = {
          ...currentCase,
          status: params.toStatus,
        };
        return currentCase;
      }),
    };

    transitionService = new CaseTransitionService(repo as OrchestratorRepository);
    guard = new IdempotencyGuardService(repo as OrchestratorRepository);

    // Mock Redis lock service to simply execute callback
    const mockRedis: any = {
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn().mockResolvedValue(1),
    };
    lockService = new CaseLockService(mockRedis);

    resolver = new ProviderAdapterResolver();
    resolver.setDefaultFallbackAdapter(mockAdapter);

    engine = new OrchestrationEngineService(
      repo as OrchestratorRepository,
      transitionService,
      lockService,
      resolver,
      guard,
    );
  });

  it('NO_SLOT scenario: authenticates to MONITORING and checkAvailability keeps case in MONITORING', async () => {
    mockAdapter.setScenario('case_orch_1', MockScenario.NO_SLOT);

    const authRes = await engine.executeAuthentication('case_orch_1');
    expect(authRes.caseState.status).toBe(BookingCaseStatus.MONITORING);

    const availRes = await engine.executeAvailabilityCheck('case_orch_1');
    expect(availRes.outcome).toBe('PENDING_NO_SLOT');
    expect(availRes.caseState.status).toBe(BookingCaseStatus.MONITORING);
  });

  it('GROUP_CAPACITY_MISMATCH scenario: returns mismatch outcome without transitioning to SLOT_FOUND', async () => {
    currentCase.status = BookingCaseStatus.MONITORING;
    mockAdapter.setScenario('case_orch_1', MockScenario.GROUP_CAPACITY_MISMATCH);

    const availRes = await engine.executeAvailabilityCheck('case_orch_1');
    expect(availRes.outcome).toBe('GROUP_CAPACITY_MISMATCH');
    expect(availRes.caseState.status).toBe(BookingCaseStatus.MONITORING);
  });

  it('CAPTCHA_REQUIRED scenario: transitions to HUMAN_VERIFICATION_REQUIRED, then resume transitions back to AUTHENTICATING', async () => {
    mockAdapter.setScenario('case_orch_1', MockScenario.CAPTCHA_REQUIRED);

    const authRes = await engine.executeAuthentication('case_orch_1');
    expect(authRes.outcome).toBe('HUMAN_ACTION_REQUIRED');
    expect(authRes.caseState.status).toBe(BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED);

    // Mock stored history with resume target
    vi.spyOn(repo, 'getLatestStateHistory').mockResolvedValue({
      id: 'h1',
      bookingCaseId: 'case_orch_1',
      fromStatus: BookingCaseStatus.AUTHENTICATING,
      toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
      actorType: StateActorType.SYSTEM,
      actorId: null,
      reason: 'Captcha challenge',
      metadata: {
        resumeToStatus: BookingCaseStatus.AUTHENTICATING,
        humanActionType: 'CAPTCHA',
      },
      createdAt: new Date(),
    });

    const resumeRes = await engine.executeResume('case_orch_1');
    expect(resumeRes.caseState.status).toBe(BookingCaseStatus.AUTHENTICATING);
  });

  it('SLOT_LOST_DURING_BOOKING scenario: transitions from SLOT_FOUND to BOOKING then to SLOT_LOST', async () => {
    currentCase.status = BookingCaseStatus.SLOT_FOUND;
    mockAdapter.setScenario('case_orch_1', MockScenario.SLOT_LOST_DURING_BOOKING);

    const bookRes = await engine.executeBooking('case_orch_1');
    expect(bookRes.outcome).toBe('SLOT_LOST');
    expect(bookRes.caseState.status).toBe(BookingCaseStatus.SLOT_LOST);
  });

  it('PAYMENT_REQUIRED scenario: progresses booking and stops at PAYMENT_REQUIRED', async () => {
    currentCase.status = BookingCaseStatus.SLOT_FOUND;
    mockAdapter.setScenario('case_orch_1', MockScenario.PAYMENT_REQUIRED);

    const bookRes = await engine.executeBooking('case_orch_1');
    expect(bookRes.outcome).toBe('PAYMENT_REQUIRED');
    expect(bookRes.caseState.status).toBe(BookingCaseStatus.PAYMENT_REQUIRED);
  });

  it('CONFIRMED scenario: runs full deterministic booking path to CONFIRMED', async () => {
    // 1. Authenticate READY -> MONITORING
    mockAdapter.setScenario('case_orch_1', MockScenario.CONFIRMED);
    const authRes = await engine.executeAuthentication('case_orch_1');
    expect(authRes.caseState.status).toBe(BookingCaseStatus.MONITORING);

    // 2. Check Availability MONITORING -> SLOT_FOUND
    const availRes = await engine.executeAvailabilityCheck('case_orch_1');
    expect(availRes.outcome).toBe('SLOT_FOUND');
    expect(availRes.caseState.status).toBe(BookingCaseStatus.SLOT_FOUND);

    // 3. Execute Booking: SLOT_FOUND -> BOOKING -> ADDING_APPLICANTS -> APPOINTMENT_SELECTED -> PAYMENT_REQUIRED -> PAYMENT_PROCESSING -> CONFIRMED
    const bookRes = await engine.executeBooking('case_orch_1');
    expect(bookRes.outcome).toBe('CONFIRMED');
    expect(bookRes.caseState.status).toBe(BookingCaseStatus.CONFIRMED);
  });
});

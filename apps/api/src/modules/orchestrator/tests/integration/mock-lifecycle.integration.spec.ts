import { describe, it, expect, beforeEach } from 'vitest';
import {
  BookingCaseStatus,
  BookingMode,
  ProviderCode,
  Gender,
  ApplicantRelation,
  StateActorType,
  type BookingCase,
  type BookingCaseStateHistory,
} from '@visaflow/database';
import {
  MockProviderAdapter,
  MockScenario,
} from '@visaflow/provider-core';
import { OrchestrationEngineService } from '../../services/orchestration-engine.service.js';
import {
  OrchestratorRepository,
  type OrchestratorBookingCase,
} from '../../repositories/orchestrator.repository.js';
import { CaseTransitionService } from '../../services/case-transition.service.js';
import { CaseLockService } from '../../infrastructure/locks/case-lock.service.js';
import { ProviderAdapterResolver } from '../../services/provider-adapter-resolver.service.js';
import { IdempotencyGuardService } from '../../services/idempotency-guard.service.js';

describe('Full Mock Lifecycle Integration Test: READY -> CONFIRMED (Section 82 & 83)', () => {
  let engine: OrchestrationEngineService;
  let mockAdapter: MockProviderAdapter;
  let inMemoryCase: OrchestratorBookingCase;
  let inMemoryHistory: BookingCaseStateHistory[];
  let inMemoryActivityLogs: any[];

  beforeEach(() => {
    mockAdapter = new MockProviderAdapter();
    inMemoryHistory = [];
    inMemoryActivityLogs = [];

    inMemoryCase = {
      id: 'case_lifecycle_confirmed',
      caseNumber: 'VF_LIFECYCLE_001',
      providerRouteId: 'route_lifecycle_1',
      status: BookingCaseStatus.READY,
      bookingMode: BookingMode.APPOINTMENT_CALENDAR,
      preferredDateFrom: new Date('2026-11-15'),
      preferredDateTo: new Date('2026-11-25'),
      preferredTime: '09:00',
      allowGroupSplit: false,
      createdById: 'user_agent_1',
      createdAt: new Date(),
      updatedAt: new Date(),
      providerRoute: {
        id: 'route_lifecycle_1',
        providerId: 'prov_vfs',
        sourceCountry: 'EG',
        destinationCountry: 'FR',
        applicationCentre: 'Cairo',
        visaCategory: 'TOURISM',
        visaSubcategory: 'SHORT_STAY',
        bookingMode: BookingMode.APPOINTMENT_CALENDAR,
        enabled: true,
        configurationJson: {
          groupRules: { minimumApplicants: 1, maximumApplicants: 5 },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        provider: {
          code: ProviderCode.VFS,
          name: 'VFS Global',
        },
      },
      bookingApplicants: [
        {
          id: 'ba_primary',
          bookingCaseId: 'case_lifecycle_confirmed',
          applicantId: 'app_tarek',
          position: 1,
          relation: ApplicantRelation.PRIMARY,
          isPrimary: true,
          createdAt: new Date(),
          applicant: {
            id: 'app_tarek',
            clientId: null,
            firstName: 'Tarek',
            lastName: 'Omar',
            gender: Gender.MALE,
            dateOfBirth: new Date('1992-03-10'),
            nationality: 'EG',
            phone: '+20100000000',
            email: 'tarek@example.com',
            passportNumberEncrypted: 'v1.fakeiv.faketag.fakecipher',
            passportNumberHash: 'hash_tarek_123',
            passportExpiry: new Date('2032-05-15'),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    };

    // Concrete repository simulation storing exactly as Prisma would
    const mockRepo: Partial<OrchestratorRepository> = {
      findCaseById: async (id: string) => (id === inMemoryCase.id ? inMemoryCase : null),
      getLatestStateHistory: async (caseId: string) => {
        const historyForCase = inMemoryHistory.filter((h) => h.bookingCaseId === caseId);
        return historyForCase.length > 0 ? historyForCase[historyForCase.length - 1]! : null;
      },
      atomicStatusTransition: async (params) => {
        inMemoryCase.status = params.toStatus;
        const historyRow: BookingCaseStateHistory = {
          id: `hist_${inMemoryHistory.length + 1}`,
          bookingCaseId: params.caseId,
          fromStatus: params.fromStatus,
          toStatus: params.toStatus,
          actorType: params.actorType,
          actorId: params.actorId ?? null,
          reason: params.reason ?? null,
          metadata: (params.metadata as any) ?? null,
          createdAt: new Date(),
        };
        inMemoryHistory.push(historyRow);
        inMemoryActivityLogs.push({
          eventType: 'CASE_STATUS_TRANSITIONED',
          from: params.fromStatus,
          to: params.toStatus,
        });

        return inMemoryCase as unknown as BookingCase;
      },
    };

    const transitionService = new CaseTransitionService(mockRepo as OrchestratorRepository);
    const guard = new IdempotencyGuardService(mockRepo as OrchestratorRepository);

    // Mock Redis lock
    const mockRedis: any = {
      set: async () => 'OK',
      eval: async () => 1,
    };
    const lockService = new CaseLockService(mockRedis);

    const resolver = new ProviderAdapterResolver();
    resolver.setDefaultFallbackAdapter(mockAdapter);

    engine = new OrchestrationEngineService(
      mockRepo as OrchestratorRepository,
      transitionService,
      lockService,
      resolver,
      guard,
    );
  });

  it('Gate Test: full mock lifecycle READY -> CONFIRMED with complete state history', async () => {
    mockAdapter.setScenario(inMemoryCase.id, MockScenario.CONFIRMED);

    // Initial state: READY
    expect(inMemoryCase.status).toBe(BookingCaseStatus.READY);

    // 1. Authenticate: READY -> AUTHENTICATING -> MONITORING
    const authRes = await engine.executeAuthentication(inMemoryCase.id);
    expect(authRes.caseState.status).toBe(BookingCaseStatus.MONITORING);

    // 2. Availability Check: MONITORING -> SLOT_FOUND
    const availRes = await engine.executeAvailabilityCheck(inMemoryCase.id);
    expect(availRes.outcome).toBe('SLOT_FOUND');
    expect(availRes.caseState.status).toBe(BookingCaseStatus.SLOT_FOUND);

    // 3. Booking Execution: SLOT_FOUND -> BOOKING -> ADDING_APPLICANTS -> APPOINTMENT_SELECTED -> PAYMENT_REQUIRED -> PAYMENT_PROCESSING -> CONFIRMED
    const bookRes = await engine.executeBooking(inMemoryCase.id, availRes.slot);
    expect(bookRes.outcome).toBe('CONFIRMED');
    expect(bookRes.caseState.status).toBe(BookingCaseStatus.CONFIRMED);
    expect(inMemoryCase.status).toBe(BookingCaseStatus.CONFIRMED);

    // Verify exact sequence of transitions recorded in BookingCaseStateHistory
    const expectedTransitions = [
      { from: BookingCaseStatus.READY, to: BookingCaseStatus.AUTHENTICATING },
      { from: BookingCaseStatus.AUTHENTICATING, to: BookingCaseStatus.MONITORING },
      { from: BookingCaseStatus.MONITORING, to: BookingCaseStatus.SLOT_FOUND },
      { from: BookingCaseStatus.SLOT_FOUND, to: BookingCaseStatus.BOOKING },
      { from: BookingCaseStatus.BOOKING, to: BookingCaseStatus.ADDING_APPLICANTS },
      { from: BookingCaseStatus.ADDING_APPLICANTS, to: BookingCaseStatus.APPOINTMENT_SELECTED },
      { from: BookingCaseStatus.APPOINTMENT_SELECTED, to: BookingCaseStatus.PAYMENT_REQUIRED },
      { from: BookingCaseStatus.PAYMENT_REQUIRED, to: BookingCaseStatus.PAYMENT_PROCESSING },
      { from: BookingCaseStatus.PAYMENT_PROCESSING, to: BookingCaseStatus.CONFIRMED },
    ];

    expect(inMemoryHistory).toHaveLength(expectedTransitions.length);

    for (let i = 0; i < expectedTransitions.length; i++) {
      expect(inMemoryHistory[i]!.fromStatus).toBe(expectedTransitions[i]!.from);
      expect(inMemoryHistory[i]!.toStatus).toBe(expectedTransitions[i]!.to);
    }

    // Verify activity logs match count
    expect(inMemoryActivityLogs).toHaveLength(expectedTransitions.length);
  });

  it('Section 83: WAITING_QUEUE route early path transitions READY -> AUTHENTICATING -> WAITING_QUEUE', async () => {
    inMemoryCase.bookingMode = BookingMode.WAITING_QUEUE;
    inMemoryCase.providerRoute.bookingMode = BookingMode.WAITING_QUEUE;
    mockAdapter.setScenario(inMemoryCase.id, MockScenario.CONFIRMED);

    const authRes = await engine.executeAuthentication(inMemoryCase.id);
    expect(authRes.caseState.status).toBe(BookingCaseStatus.WAITING_QUEUE);

    expect(inMemoryHistory[0]!.fromStatus).toBe(BookingCaseStatus.READY);
    expect(inMemoryHistory[0]!.toStatus).toBe(BookingCaseStatus.AUTHENTICATING);

    expect(inMemoryHistory[1]!.fromStatus).toBe(BookingCaseStatus.AUTHENTICATING);
    expect(inMemoryHistory[1]!.toStatus).toBe(BookingCaseStatus.WAITING_QUEUE);
  });
});

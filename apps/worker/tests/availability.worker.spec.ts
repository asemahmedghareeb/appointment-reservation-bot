import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityWorker } from '../src/queues/availability.worker.js';
import { BookingCaseStatus, StateActorType } from '@visaflow/database';
import { ProviderCode } from '@visaflow/shared-types';

describe('AvailabilityWorker Unit Tests', () => {
  let worker: AvailabilityWorker;
  let mockRepo: any;
  let mockContextLoader: any;
  let mockAdapterRegistry: any;
  let mockSessionService: any;
  let mockAdapter: any;

  const config: any = {
    workerId: 'worker-unit-test-1',
    redisUrl: 'redis://localhost:6379',
    queuePrefix: 'visaflow',
    vfsHeadless: true,
    vfsNavTimeoutMs: 10000,
    vfsActionTimeoutMs: 5000,
    vfsAllowedOrigins: ['http://127.0.0.1'],
    sessionTtlMinutes: 30,
  };

  const sampleCase: any = {
    id: 'case_unit_1',
    status: BookingCaseStatus.READY,
    providerAccountId: 'acc_1',
    providerRoute: {
      provider: { code: ProviderCode.VFS },
      sourceCountry: 'EG',
      destinationCountry: 'GR',
      applicationCentre: 'Cairo',
      visaCategory: 'TOURISM',
      visaSubcategory: 'TOURISM',
      configurationJson: {},
    },
    bookingApplicants: [],
  };

  const sampleContext: any = {
    caseId: 'case_unit_1',
    correlationId: 'corr_1',
    applicantCount: 1,
    providerAccountId: 'acc_1',
    providerRoute: {
      providerCode: ProviderCode.VFS,
      sourceCountry: 'EG',
      destinationCountry: 'GR',
      applicationCentre: 'Cairo',
      visaCategory: 'TOURISM',
      visaSubcategory: 'TOURISM',
      bookingMode: 'INDIVIDUAL',
      configuration: {},
    },
    casePreferences: {},
  };

  beforeEach(() => {
    mockRepo = {
      findCaseById: vi.fn().mockResolvedValue(sampleCase),
      atomicConditionalTransition: vi.fn().mockResolvedValue(true),
      findActiveSessionByCaseId: vi.fn().mockResolvedValue({ id: 'sess_1', workerId: 'worker-unit-test-1' }),
    };

    mockContextLoader = {
      loadContextAndApplicants: vi.fn().mockResolvedValue({
        bookingCase: sampleCase,
        context: sampleContext,
        applicants: [],
      }),
    };

    mockAdapter = {
      authenticate: vi.fn().mockResolvedValue({ kind: 'SUCCESS', sessionId: 'sess_1' }),
      inspectRoute: vi.fn().mockResolvedValue({ kind: 'SUCCESS' }),
      checkAvailability: vi.fn(),
    };

    mockAdapterRegistry = {
      resolve: vi.fn().mockReturnValue(mockAdapter),
    };

    mockSessionService = {
      createSession: vi.fn().mockResolvedValue({ id: 'sess_1' }),
      recordHumanVerificationCheckpoint: vi.fn().mockResolvedValue({}),
      completeSession: vi.fn().mockResolvedValue({}),
    };

    worker = new AvailabilityWorker(
      config,
      mockRepo,
      mockContextLoader,
      mockAdapterRegistry,
      mockSessionService,
    );
  });

  it('handles NO_SLOT: case transitions to MONITORING, returns NO_SLOT without booking job', async () => {
    mockAdapter.checkAvailability.mockResolvedValue({
      kind: 'SUCCESS',
      data: { outcome: 'NO_SLOT', candidates: [] },
    });

    const job: any = {
      id: 'job_avail_1',
      data: {
        version: 1,
        jobType: 'AVAILABILITY_CHECK',
        caseId: 'case_unit_1',
        correlationId: 'corr_1',
        cycleId: 'cycle_1',
        idempotencyKey: 'idem_1',
        expectedStatuses: [BookingCaseStatus.READY],
        createdAt: new Date().toISOString(),
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('NO_SLOT');

    // Verify transitions
    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.READY,
      toStatus: BookingCaseStatus.AUTHENTICATING,
    }));
    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.AUTHENTICATING,
      toStatus: BookingCaseStatus.MONITORING,
    }));
  });

  it('handles GROUP_CAPACITY_MISMATCH: does NOT transition to SLOT_FOUND', async () => {
    mockAdapter.checkAvailability.mockResolvedValue({
      kind: 'SUCCESS',
      data: { outcome: 'GROUP_CAPACITY_MISMATCH', candidates: [] },
    });

    const job: any = {
      id: 'job_avail_2',
      data: {
        version: 1,
        jobType: 'AVAILABILITY_CHECK',
        caseId: 'case_unit_1',
        correlationId: 'corr_2',
        cycleId: 'cycle_2',
        idempotencyKey: 'idem_2',
        expectedStatuses: [BookingCaseStatus.READY],
        createdAt: new Date().toISOString(),
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('GROUP_CAPACITY_MISMATCH');

    // Ensure it did NOT transition to SLOT_FOUND
    const transitions = mockRepo.atomicConditionalTransition.mock.calls;
    const transitionedToSlotFound = transitions.some(
      (call: any) => call[0].toStatus === BookingCaseStatus.SLOT_FOUND,
    );
    expect(transitionedToSlotFound).toBe(false);
  });

  it('handles SLOT_FOUND: transitions to SLOT_FOUND and prepares booking job', async () => {
    const slot = {
      externalSlotId: 'slot_123',
      date: '2026-11-16',
      time: '09:00',
      applicationCentre: 'Cairo',
      category: 'TOURISM',
      capacity: 2,
    };

    mockAdapter.checkAvailability.mockResolvedValue({
      kind: 'SUCCESS',
      data: { outcome: 'SLOT_FOUND', slot, candidates: [slot] },
    });


    const job: any = {
      id: 'job_avail_3',
      data: {
        version: 1,
        jobType: 'AVAILABILITY_CHECK',
        caseId: 'case_unit_1',
        correlationId: 'corr_3',
        cycleId: 'cycle_3',
        idempotencyKey: 'idem_3',
        expectedStatuses: [BookingCaseStatus.READY],
        createdAt: new Date().toISOString(),
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('SLOT_FOUND');

    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.MONITORING,
      toStatus: BookingCaseStatus.SLOT_FOUND,
    }));
  });

  it('handles HUMAN_ACTION_REQUIRED during authentication: transitions to HUMAN_VERIFICATION_REQUIRED and records checkpoint', async () => {
    mockAdapter.authenticate.mockResolvedValue({
      kind: 'HUMAN_ACTION_REQUIRED',
      action: 'CAPTCHA',
      resumeToStatus: BookingCaseStatus.AUTHENTICATING,
      safeMessage: 'Cloudflare Turnstile challenge present',
      checkpoint: { pageType: 'HUMAN_VERIFICATION' },
    });

    const job: any = {
      id: 'job_avail_4',
      data: {
        version: 1,
        jobType: 'AVAILABILITY_CHECK',
        caseId: 'case_unit_1',
        correlationId: 'corr_4',
        cycleId: 'cycle_4',
        idempotencyKey: 'idem_4',
        expectedStatuses: [BookingCaseStatus.READY],
        createdAt: new Date().toISOString(),
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('HUMAN_ACTION_REQUIRED');

    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.AUTHENTICATING,
      toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
      metadata: expect.objectContaining({
        humanActionType: 'CAPTCHA',
        resumeToStatus: BookingCaseStatus.AUTHENTICATING,
      }),
    }));

    expect(mockSessionService.recordHumanVerificationCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      humanActionType: 'CAPTCHA',
      resumeToStatus: BookingCaseStatus.AUTHENTICATING,
    }));
  });
});

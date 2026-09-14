import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionResumeWorker } from '../src/queues/session-resume.worker.js';
import { BookingCaseStatus } from '@visaflow/database';
import { ProviderCode } from '@visaflow/shared-types';

describe('SessionResumeWorker Unit Tests', () => {
  let worker: SessionResumeWorker;
  let mockRepo: any;
  let mockContextLoader: any;
  let mockAdapterRegistry: any;
  let mockSessionService: any;
  let mockAdapter: any;

  const currentWorkerId = 'worker-resume-test-1';
  const config: any = {
    workerId: currentWorkerId,
    redisUrl: 'redis://localhost:6379',
    queuePrefix: 'visaflow',
    vfsHeadless: true,
    vfsNavTimeoutMs: 10000,
    vfsActionTimeoutMs: 5000,
    vfsAllowedOrigins: ['http://127.0.0.1'],
    sessionTtlMinutes: 30,
  };

  const sampleCase: any = {
    id: 'case_resume_1',
    status: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
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

  const activeSession: any = {
    id: 'sess_resume_1',
    workerId: currentWorkerId,
    status: 'HUMAN_ACTION_REQUIRED',
    resumeToStatus: BookingCaseStatus.AUTHENTICATING,
  };

  beforeEach(() => {
    mockRepo = {
      findCaseById: vi.fn().mockResolvedValue(sampleCase),
      atomicConditionalTransition: vi.fn().mockResolvedValue(true),
      findActiveSessionByCaseId: vi.fn().mockResolvedValue(activeSession),
    };

    mockContextLoader = {
      loadContextAndApplicants: vi.fn().mockResolvedValue({
        bookingCase: sampleCase,
        context: {
          caseId: 'case_resume_1',
          correlationId: 'corr_res_1',
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
        },
        applicants: [],
      }),
    };

    mockAdapter = {
      resume: vi.fn().mockResolvedValue({ kind: 'SUCCESS' }),
      getPaymentState: vi.fn(),
      getConfirmation: vi.fn(),
    };

    mockAdapterRegistry = {
      resolve: vi.fn().mockReturnValue(mockAdapter),
    };

    mockSessionService = {
      assertSessionOwnership: vi.fn((wId: string) => wId === currentWorkerId),
      completeSession: vi.fn().mockResolvedValue({}),
    };

    worker = new SessionResumeWorker(
      config,
      mockRepo,
      mockContextLoader,
      mockAdapterRegistry,
      mockSessionService,
    );
  });

  it('rejects resume with SESSION_OWNER_MISMATCH if owned by another worker', async () => {
    mockRepo.findActiveSessionByCaseId.mockResolvedValueOnce({
      ...activeSession,
      workerId: 'other-worker-999',
    });

    const job: any = {
      id: 'job_res_mismatch',
      data: {
        version: 1,
        jobType: 'SESSION_RESUME',
        caseId: 'case_resume_1',
        correlationId: 'corr_mismatch',
        cycleId: 'cycle_mismatch',
        idempotencyKey: 'idem_mismatch',
        expectedStatuses: [BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED],
        createdAt: new Date().toISOString(),
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('SESSION_OWNER_MISMATCH');
    expect(mockAdapter.resume).not.toHaveBeenCalled();
  });

  it('successfully resumes from HUMAN_VERIFICATION_REQUIRED to target status', async () => {
    const job: any = {
      id: 'job_res_ok',
      data: {
        version: 1,
        jobType: 'SESSION_RESUME',
        caseId: 'case_resume_1',
        correlationId: 'corr_res_ok',
        cycleId: 'cycle_res_ok',
        idempotencyKey: 'idem_res_ok',
        expectedStatuses: [BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED],
        createdAt: new Date().toISOString(),
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('RESUMED');

    expect(mockAdapter.resume).toHaveBeenCalled();
    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
      toStatus: BookingCaseStatus.AUTHENTICATING,
    }));
  });

  it('handles manual payment completion: transitions PAYMENT_REQUIRED -> PAYMENT_PROCESSING -> CONFIRMED', async () => {
    mockRepo.findCaseById.mockResolvedValueOnce({
      ...sampleCase,
      status: BookingCaseStatus.PAYMENT_REQUIRED,
    });

    mockAdapter.getPaymentState.mockResolvedValueOnce({
      kind: 'SUCCESS',
      data: {
        paymentState: 'PAID',
        amount: 85.5,
        currency: 'EUR',
      },
    });

    mockAdapter.getConfirmation.mockResolvedValueOnce({
      kind: 'SUCCESS',
      data: {
        referenceNumber: 'GR-CAI-2026-CONF-9988',
        appointmentDate: '2026-11-16',
        centre: 'Cairo',
      },
    });

    const job: any = {
      id: 'job_res_payment',
      data: {
        version: 1,
        jobType: 'SESSION_RESUME',
        caseId: 'case_resume_1',
        correlationId: 'corr_pay_ok',
        cycleId: 'cycle_pay_ok',
        idempotencyKey: 'idem_pay_ok',
        expectedStatuses: [BookingCaseStatus.PAYMENT_REQUIRED],
        createdAt: new Date().toISOString(),
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('CONFIRMED');

    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.PAYMENT_REQUIRED,
      toStatus: BookingCaseStatus.PAYMENT_PROCESSING,
    }));

    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.PAYMENT_PROCESSING,
      toStatus: BookingCaseStatus.CONFIRMED,
      metadata: expect.objectContaining({
        referenceNumber: 'GR-CAI-2026-CONF-9988',
      }),
    }));

    expect(mockSessionService.completeSession).toHaveBeenCalledWith('sess_resume_1');
  });
});

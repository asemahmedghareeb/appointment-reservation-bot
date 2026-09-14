import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingWorker } from '../src/queues/booking.worker.js';
import { BookingCaseStatus } from '@visaflow/database';
import { ProviderCode } from '@visaflow/shared-types';

describe('BookingWorker Unit Tests', () => {
  let worker: BookingWorker;
  let mockRepo: any;
  let mockContextLoader: any;
  let mockAdapterRegistry: any;
  let mockSessionService: any;
  let mockPaymentHandoffService: any;
  let mockAdapter: any;

  const config: any = {
    workerId: 'worker-booking-test-1',
    redisUrl: 'redis://localhost:6379',
    queuePrefix: 'visaflow',
    vfsHeadless: true,
    vfsNavTimeoutMs: 10000,
    vfsActionTimeoutMs: 5000,
    vfsAllowedOrigins: ['http://127.0.0.1'],
    sessionTtlMinutes: 30,
  };

  const sampleCase: any = {
    id: 'case_booking_1',
    status: BookingCaseStatus.SLOT_FOUND,
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

  const sampleSlot = {
    externalSlotId: 'slot_999',
    date: '2026-11-16',
    time: '10:00',
    applicationCentre: 'Cairo',
    category: 'TOURISM',
    capacity: 1,
  };

  beforeEach(() => {
    mockRepo = {
      findCaseById: vi.fn().mockResolvedValue(sampleCase),
      atomicConditionalTransition: vi.fn().mockResolvedValue(true),
      findActiveSessionByCaseId: vi.fn().mockResolvedValue({ id: 'sess_book_1', workerId: 'worker-booking-test-1' }),
    };

    mockContextLoader = {
      loadContextAndApplicants: vi.fn().mockResolvedValue({
        bookingCase: sampleCase,
        context: {
          caseId: 'case_booking_1',
          correlationId: 'corr_book_1',
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
        applicants: [
          {
            id: 'app_1',
            position: 1,
            isPrimary: true,
            relation: 'PRIMARY',
            firstName: 'Ahmed',
            lastName: 'Hassan',
            gender: 'MALE',
            dateOfBirth: '1990-01-01',
            nationality: 'EGY',
            passportNumber: 'A12345678',
            passportExpiry: '2030-01-01',
          },
        ],
      }),
    };

    mockAdapter = {
      beginBooking: vi.fn().mockResolvedValue({ kind: 'SUCCESS', data: { outcome: 'STARTED' } }),
      addApplicants: vi.fn().mockResolvedValue({ kind: 'SUCCESS' }),
      selectAppointment: vi.fn().mockResolvedValue({ kind: 'SUCCESS' }),
      getPaymentState: vi.fn().mockResolvedValue({
        kind: 'SUCCESS',
        data: {
          paymentState: 'PENDING',
          amount: 85.5,
          currency: 'EUR',
          reference: 'VFS-EGY-REF-001',
        },
      }),
    };

    mockAdapterRegistry = {
      resolve: vi.fn().mockReturnValue(mockAdapter),
    };

    mockSessionService = {
      recordPaymentHandoff: vi.fn().mockResolvedValue({}),
      recordHumanVerificationCheckpoint: vi.fn().mockResolvedValue({}),
    };

    mockPaymentHandoffService = {
      createHandoff: vi.fn().mockResolvedValue({ id: 'handoff_1' }),
    };

    worker = new BookingWorker(
      config,
      mockRepo,
      mockContextLoader,
      mockAdapterRegistry,
      mockSessionService,
      mockPaymentHandoffService,
    );
  });

  it('skips execution if case is not in SLOT_FOUND (stale job protection)', async () => {
    mockRepo.findCaseById.mockResolvedValueOnce({
      ...sampleCase,
      status: BookingCaseStatus.PAYMENT_REQUIRED,
    });

    const job: any = {
      id: 'job_booking_stale',
      data: {
        version: 1,
        jobType: 'BOOKING_EXECUTION',
        caseId: 'case_booking_1',
        correlationId: 'corr_1',
        cycleId: 'cycle_1',
        idempotencyKey: 'idem_1',
        expectedStatuses: [BookingCaseStatus.SLOT_FOUND],
        createdAt: new Date().toISOString(),
        payload: { slot: sampleSlot },
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('SKIPPED_ALREADY_APPLIED');
    expect(mockAdapter.beginBooking).not.toHaveBeenCalled();
  });


  it('executes full booking flow through PAYMENT_REQUIRED and records PaymentHandoff safely', async () => {
    const job: any = {
      id: 'job_booking_ok',
      data: {
        version: 1,
        jobType: 'BOOKING_EXECUTION',
        caseId: 'case_booking_1',
        correlationId: 'corr_2',
        cycleId: 'cycle_2',
        idempotencyKey: 'idem_2',
        expectedStatuses: [BookingCaseStatus.SLOT_FOUND],
        createdAt: new Date().toISOString(),
        payload: { slot: sampleSlot },
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('PAYMENT_REQUIRED');

    // Verify progression: SLOT_FOUND -> BOOKING -> ADDING_APPLICANTS -> APPOINTMENT_SELECTED -> PAYMENT_REQUIRED
    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.SLOT_FOUND,
      toStatus: BookingCaseStatus.BOOKING,
    }));
    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.BOOKING,
      toStatus: BookingCaseStatus.ADDING_APPLICANTS,
    }));
    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.ADDING_APPLICANTS,
      toStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
    }));
    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.APPOINTMENT_SELECTED,
      toStatus: BookingCaseStatus.PAYMENT_REQUIRED,
    }));

    // Verify PaymentHandoff creation
    expect(mockPaymentHandoffService.createHandoff).toHaveBeenCalledWith(expect.objectContaining({
      bookingCaseId: 'case_booking_1',
      automationSessionId: 'sess_book_1',
      amount: 85.5,
      currency: 'EUR',
      externalReference: 'VFS-EGY-REF-001',
    }));
  });

  it('handles SLOT_LOST during beginBooking: transitions to SLOT_LOST, NOT FAILED', async () => {
    mockAdapter.beginBooking.mockResolvedValueOnce({
      kind: 'RETRYABLE_FAILURE',
      code: 'SLOT_LOST',
      safeMessage: 'Selected appointment slot is no longer available',
    });

    const job: any = {
      id: 'job_booking_lost',
      data: {
        version: 1,
        jobType: 'BOOKING_EXECUTION',
        caseId: 'case_booking_1',
        correlationId: 'corr_3',
        cycleId: 'cycle_3',
        idempotencyKey: 'idem_3',
        expectedStatuses: [BookingCaseStatus.SLOT_FOUND],
        createdAt: new Date().toISOString(),
        payload: { slot: sampleSlot },
      },
    };

    const res = await worker.processJob(job);
    expect(res.outcome).toBe('SLOT_LOST');

    expect(mockRepo.atomicConditionalTransition).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: BookingCaseStatus.BOOKING,
      toStatus: BookingCaseStatus.SLOT_LOST,
    }));

    // Ensure it was NOT marked FAILED
    const transitions = mockRepo.atomicConditionalTransition.mock.calls;
    const transitionedToFailed = transitions.some(
      (call: any) => call[0].toStatus === BookingCaseStatus.FAILED,
    );
    expect(transitionedToFailed).toBe(false);
  });
});

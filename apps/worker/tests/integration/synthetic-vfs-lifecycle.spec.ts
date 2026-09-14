import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SyntheticVfsServer } from '../../../../packages/vfs-adapter/tests/test-server/synthetic-vfs-server.js';
import {
  VfsBrowserSessionManager,
  VfsProviderAdapter,
  createVfsConfig,
  type VfsCredentialsProvider,
} from '@visaflow/vfs-adapter';
import { AvailabilityWorker } from '../../src/queues/availability.worker.js';
import { BookingWorker } from '../../src/queues/booking.worker.js';
import { SessionResumeWorker } from '../../src/queues/session-resume.worker.js';
import { ProviderAdapterRegistryService } from '../../src/services/provider-adapter-registry.service.js';
import { AutomationSessionService } from '../../src/services/automation-session.service.js';
import { PaymentHandoffService } from '../../src/services/payment-handoff.service.js';
import { BookingCaseStatus, StateActorType } from '@visaflow/database';
import { ProviderCode } from '@visaflow/shared-types';

describe('Integration: Synthetic VFS Full Lifecycle', () => {
  let server: SyntheticVfsServer;
  let serverUrl: string;
  let sessionManager: VfsBrowserSessionManager;
  let adapter: VfsProviderAdapter;

  const workerId = 'integration-worker-lifecycle-1';
  const recordedTransitions: Array<{ from: BookingCaseStatus; to: BookingCaseStatus; reason?: string }> = [];

  beforeAll(async () => {
    server = new SyntheticVfsServer();
    server.setScenario('HAPPY_PATH');
    serverUrl = await server.start();

    const vfsConfig = createVfsConfig({
      headless: true,
      navigationTimeoutMs: 15000,
      actionTimeoutMs: 10000,
      allowedOrigins: [serverUrl],
      sessionTtlMinutes: 30,
    });

    const credsProvider: VfsCredentialsProvider = {
      getCredentials: async () => ({
        email: 'applicant.test@example.com',
        password: 'SecurePassword123!',
      }),
    };

    sessionManager = new VfsBrowserSessionManager(vfsConfig, workerId);
    adapter = new VfsProviderAdapter(sessionManager, credsProvider, vfsConfig);
  });

  afterAll(async () => {
    await sessionManager.closeAll();
    await server.stop();
  });

  it(
    'executes full path: READY -> AUTHENTICATING -> MONITORING -> SLOT_FOUND -> BOOKING -> ADDING_APPLICANTS -> APPOINTMENT_SELECTED -> PAYMENT_REQUIRED -> PAYMENT_PROCESSING -> CONFIRMED',
    async () => {

    let currentCaseStatus: BookingCaseStatus = BookingCaseStatus.READY;
    const caseId = 'case_integration_lifecycle_1';
    let activeSessionRecord: any = null;
    let paymentHandoffRecord: any = null;

    // In-memory mock repository implementing the worker operations
    const mockRepo: any = {
      findCaseById: async (id: string) => ({
        id,
        status: currentCaseStatus,
        providerAccountId: 'acc_vfs_1',
        allowGroupSplit: false,
        providerRoute: {
          id: 'route_eg_gr',
          provider: { code: ProviderCode.VFS },
          sourceCountry: 'EG',
          destinationCountry: 'GR',
          applicationCentre: 'Alexandria',
          visaCategory: 'Schengen Visa',
          visaSubcategory: 'Tourism',

          bookingMode: 'INDIVIDUAL',
          configurationJson: {
            adapterProfile: 'VFS_STANDARD',
            entryUrl: `${serverUrl}/login`,
            availabilityMode: 'EARLIEST_SLOT',
            expectedProviderCode: 'VFS',
          },
        },
        bookingApplicants: [
          {
            id: 'ba_1',
            position: 1,
            isPrimary: true,
            relation: 'PRIMARY',
            applicant: {
              id: 'app_1',
              firstName: 'Karim',
              lastName: 'Farouk',
              gender: 'MALE',
              dateOfBirth: new Date('1990-05-15'),
              nationality: 'EGY',
              passportNumberEncrypted: 'mock_encrypted_passport',
              passportExpiry: new Date('2030-05-15'),
              phone: '+201000000000',
              email: 'karim@example.com',
            },
          },
        ],
      }),

      atomicConditionalTransition: async (params: any) => {
        if (params.fromStatus !== currentCaseStatus) {
          return false;
        }
        currentCaseStatus = params.toStatus;
        recordedTransitions.push({
          from: params.fromStatus,
          to: params.toStatus,
          reason: params.reason,
        });
        return true;
      },

      createAutomationSession: async (data: any) => {
        activeSessionRecord = {
          id: 'session_auto_1',
          ...data,
        };
        return activeSessionRecord;
      },

      updateAutomationSession: async (_id: string, data: any) => {
        if (activeSessionRecord) {
          Object.assign(activeSessionRecord, data);
        }
        return activeSessionRecord;
      },

      findActiveSessionByCaseId: async () => activeSessionRecord,

      createPaymentHandoff: async (data: any) => {
        paymentHandoffRecord = {
          id: 'handoff_1',
          ...data,
        };
        return paymentHandoffRecord;
      },
    };

    const mockContextLoader: any = {
      loadContextAndApplicants: async () => {
        const c = await mockRepo.findCaseById(caseId);
        return {
          bookingCase: c,
          context: {
            caseId,
            correlationId: 'corr_life_1',
            applicantCount: 1,
            providerAccountId: 'acc_vfs_1',
            providerRoute: {
              id: 'route_eg_gr',
              providerCode: ProviderCode.VFS,
              sourceCountry: 'EG',
              destinationCountry: 'GR',
              applicationCentre: 'Alexandria',
              visaCategory: 'Schengen Visa',
              visaSubcategory: 'Tourism',

              bookingMode: 'INDIVIDUAL' as any,
              configuration: {
                adapterProfile: 'VFS_STANDARD',
                entryUrl: `${serverUrl}/login`,
                availabilityMode: 'EARLIEST_SLOT',
                expectedProviderCode: 'VFS',
              },
            },
            casePreferences: { allowGroupSplit: false },
          },
          applicants: [
            {
              id: 'app_1',
              position: 1,
              isPrimary: true,
              relation: 'PRIMARY',
              firstName: 'Karim',
              lastName: 'Farouk',
              gender: 'MALE',
              dateOfBirth: '1990-05-15',
              nationality: 'EGY',
              passportNumber: 'A98765432',
              passportExpiry: '2030-05-15',
              phone: '+201000000000',
              email: 'karim@example.com',
            },
          ],
        };
      },
    };

    const adapterRegistry = new ProviderAdapterRegistryService();
    adapterRegistry.register(ProviderCode.VFS, adapter);

    const sessionService = new AutomationSessionService(mockRepo, workerId);
    const paymentHandoffService = new PaymentHandoffService(mockRepo);

    const workerConfig: any = {
      workerId,
      redisUrl: 'redis://localhost:6379',
      queuePrefix: 'visaflow',
      vfsHeadless: true,
      vfsNavTimeoutMs: 15000,
      vfsActionTimeoutMs: 10000,
      vfsAllowedOrigins: [serverUrl],
      sessionTtlMinutes: 30,
    };

    const availWorker = new AvailabilityWorker(
      workerConfig,
      mockRepo,
      mockContextLoader,
      adapterRegistry,
      sessionService,
    );

    const bookingWorker = new BookingWorker(
      workerConfig,
      mockRepo,
      mockContextLoader,
      adapterRegistry,
      sessionService,
      paymentHandoffService,
    );

    const resumeWorker = new SessionResumeWorker(
      workerConfig,
      mockRepo,
      mockContextLoader,
      adapterRegistry,
      sessionService,
    );

    // Step 1: Execute availability job
    const availJob: any = {
      id: 'job_avail_e2e',
      data: {
        version: 1,
        jobType: 'AVAILABILITY_CHECK',
        caseId,
        correlationId: 'corr_life_1',
        cycleId: 'cycle_1',
        idempotencyKey: 'idem_avail_1',
        expectedStatuses: [BookingCaseStatus.READY],
        createdAt: new Date().toISOString(),
      },
    };

    const availRes = await availWorker.processJob(availJob);
    expect(availRes.outcome).toBe('SLOT_FOUND');
    expect(currentCaseStatus).toBe(BookingCaseStatus.SLOT_FOUND);

    // Step 2: Execute booking job with discovered slot
    const slot = {
      externalSlotId: 'slot_earliest_01',
      date: '2026-11-16',
      time: '09:00',
      applicationCentre: 'Alexandria',
      category: 'Schengen Visa',
      capacity: 2,

    };

    const bookingJob: any = {
      id: 'job_book_e2e',
      data: {
        version: 1,
        jobType: 'BOOKING_EXECUTION',
        caseId,
        correlationId: 'corr_life_1',
        cycleId: 'cycle_1',
        idempotencyKey: 'idem_book_1',
        expectedStatuses: [BookingCaseStatus.SLOT_FOUND],
        createdAt: new Date().toISOString(),
        payload: { slot },
      },
    };

    const bookRes = await bookingWorker.processJob(bookingJob);
    expect(bookRes.outcome).toBe('PAYMENT_REQUIRED');
    expect(currentCaseStatus).toBe(BookingCaseStatus.PAYMENT_REQUIRED);

    // Assert PaymentHandoff was recorded safely
    expect(paymentHandoffRecord).toBeDefined();
    expect(paymentHandoffRecord.status).toBe('REQUIRED');
    expect(paymentHandoffRecord.amount).toBe(45);
    expect(paymentHandoffRecord.currency).toBe('EUR');

    expect(paymentHandoffRecord.externalReference).toBe('PAY-VFS-2026-9988');
    // Ensure no sensitive card data

    expect(paymentHandoffRecord.cardNumber).toBeUndefined();
    expect(paymentHandoffRecord.cvv).toBeUndefined();

    // Step 3: Simulate explicit human payment completion on the synthetic provider
    server.paymentCompleted = true;

    // Step 4: Execute session-resume job
    const resumeJob: any = {
      id: 'job_resume_e2e',
      data: {
        version: 1,
        jobType: 'SESSION_RESUME',
        caseId,
        correlationId: 'corr_life_1',
        cycleId: 'cycle_1',
        idempotencyKey: 'idem_resume_1',
        expectedStatuses: [BookingCaseStatus.PAYMENT_REQUIRED],
        createdAt: new Date().toISOString(),
      },
    };

    const resumeRes = await resumeWorker.processJob(resumeJob);
    expect(resumeRes.outcome).toBe('CONFIRMED');
    expect(currentCaseStatus).toBe(BookingCaseStatus.CONFIRMED);

    // Verify exact sequence of transitions
    const transitionSequence = recordedTransitions.map((t) => `${t.from} -> ${t.to}`);
    expect(transitionSequence).toEqual([
      'READY -> AUTHENTICATING',
      'AUTHENTICATING -> MONITORING',
      'MONITORING -> SLOT_FOUND',
      'SLOT_FOUND -> BOOKING',
      'BOOKING -> ADDING_APPLICANTS',
      'ADDING_APPLICANTS -> APPOINTMENT_SELECTED',
      'APPOINTMENT_SELECTED -> PAYMENT_REQUIRED',
      'PAYMENT_REQUIRED -> PAYMENT_PROCESSING',
      'PAYMENT_PROCESSING -> CONFIRMED',
    ]);
  }, 30000);
});


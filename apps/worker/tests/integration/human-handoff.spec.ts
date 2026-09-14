import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SyntheticVfsServer } from '../../../../packages/vfs-adapter/tests/test-server/synthetic-vfs-server.js';
import {
  VfsBrowserSessionManager,
  VfsProviderAdapter,
  createVfsConfig,
  type VfsCredentialsProvider,
} from '@visaflow/vfs-adapter';
import { AvailabilityWorker } from '../../src/queues/availability.worker.js';
import { SessionResumeWorker } from '../../src/queues/session-resume.worker.js';
import { ProviderAdapterRegistryService } from '../../src/services/provider-adapter-registry.service.js';
import { AutomationSessionService } from '../../src/services/automation-session.service.js';
import { BookingCaseStatus, StateActorType } from '@visaflow/database';
import { ProviderCode } from '@visaflow/shared-types';
import { decrypt } from '@visaflow/crypto';

describe('Integration: Human Handoff (CAPTCHA, OTP, Session Ownership)', () => {
  let server: SyntheticVfsServer;
  let serverUrl: string;
  let sessionManager: VfsBrowserSessionManager;
  let adapter: VfsProviderAdapter;

  const workerId = 'integration-worker-human-1';

  beforeAll(async () => {
    server = new SyntheticVfsServer();
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

  it('CAPTCHA pause, session preservation, and resume flow', async () => {
    server.setScenario('CAPTCHA');
    let currentCaseStatus: BookingCaseStatus = BookingCaseStatus.READY;
    const caseId = 'case_captcha_1';
    let sessionRecord: any = null;

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
          applicationCentre: 'Cairo',
          visaCategory: 'Short Stay',
          visaSubcategory: 'Tourism',
          bookingMode: 'INDIVIDUAL',
          configurationJson: {
            adapterProfile: 'VFS_STANDARD',
            entryUrl: `${serverUrl}/login`,
            availabilityMode: 'EARLIEST_SLOT',
            expectedProviderCode: 'VFS',
          },
        },
        bookingApplicants: [],
      }),

      atomicConditionalTransition: async (params: any) => {
        if (params.fromStatus !== currentCaseStatus) {
          return false;
        }
        currentCaseStatus = params.toStatus;
        return true;
      },

      createAutomationSession: async (data: any) => {
        sessionRecord = { id: 'sess_cap_1', ...data };
        return sessionRecord;
      },

      updateAutomationSession: async (_id: string, data: any) => {
        if (sessionRecord) {
          Object.assign(sessionRecord, data);
        }
        return sessionRecord;
      },

      findActiveSessionByCaseId: async () => sessionRecord,
    };

    const mockContextLoader: any = {
      loadContextAndApplicants: async () => {
        const c = await mockRepo.findCaseById(caseId);
        return {
          bookingCase: c,
          context: {
            caseId,
            correlationId: 'corr_cap_1',
            applicantCount: 1,
            providerAccountId: 'acc_vfs_1',
            providerRoute: {
              id: 'route_eg_gr',
              providerCode: ProviderCode.VFS,
              sourceCountry: 'EG',
              destinationCountry: 'GR',
              applicationCentre: 'Cairo',
              visaCategory: 'Short Stay',
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
          applicants: [],
        };
      },
    };

    const adapterRegistry = new ProviderAdapterRegistryService();
    adapterRegistry.register(ProviderCode.VFS, adapter);

    const sessionService = new AutomationSessionService(mockRepo, workerId);

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

    const resumeWorker = new SessionResumeWorker(
      workerConfig,
      mockRepo,
      mockContextLoader,
      adapterRegistry,
      sessionService,
    );

    // 1. Run availability job -> hits CAPTCHA on login
    const availJob: any = {
      id: 'job_cap_avail',
      data: {
        version: 1,
        jobType: 'AVAILABILITY_CHECK',
        caseId,
        correlationId: 'corr_cap_1',
        cycleId: 'cycle_1',
        idempotencyKey: 'idem_cap_1',
        expectedStatuses: [BookingCaseStatus.READY],
        createdAt: new Date().toISOString(),
      },
    };

    const availRes = await availWorker.processJob(availJob);
    expect(availRes.outcome).toBe('HUMAN_ACTION_REQUIRED');
    expect(currentCaseStatus).toBe(BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED);

    // Verify session was preserved with correct checkpoint
    expect(sessionRecord).toBeDefined();
    expect(sessionRecord.status).toBe('HUMAN_ACTION_REQUIRED');
    expect(sessionRecord.humanActionType).toBe('CAPTCHA');
    expect(sessionRecord.resumeToStatus).toBe(BookingCaseStatus.AUTHENTICATING);

    // 2. Clear challenge (simulate human operator solving CAPTCHA)
    server.humanChallengeCleared = true;

    // 3. Run session-resume job
    const resumeJob: any = {
      id: 'job_cap_resume',
      data: {
        version: 1,
        jobType: 'SESSION_RESUME',
        caseId,
        correlationId: 'corr_cap_1',
        cycleId: 'cycle_1',
        idempotencyKey: 'idem_cap_res',
        expectedStatuses: [BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED],
        createdAt: new Date().toISOString(),
      },
    };

    const resumeRes = await resumeWorker.processJob(resumeJob);
    expect(resumeRes.outcome).toBe('RESUMED');
    expect(currentCaseStatus).toBe(BookingCaseStatus.AUTHENTICATING);
  }, 30000);

  it('OTP detection sets humanActionType to OTP', async () => {

    server.setScenario('OTP');
    let currentCaseStatus: BookingCaseStatus = BookingCaseStatus.READY;
    const caseId = 'case_otp_1';
    let sessionRecord: any = null;

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
          applicationCentre: 'Cairo',
          visaCategory: 'Short Stay',
          visaSubcategory: 'Tourism',
          bookingMode: 'INDIVIDUAL',
          configurationJson: {
            adapterProfile: 'VFS_STANDARD',
            entryUrl: `${serverUrl}/login`,
            availabilityMode: 'EARLIEST_SLOT',
            expectedProviderCode: 'VFS',
          },
        },
        bookingApplicants: [],
      }),
      atomicConditionalTransition: async (params: any) => {
        currentCaseStatus = params.toStatus;
        return true;
      },
      createAutomationSession: async (data: any) => {
        sessionRecord = { id: 'sess_otp_1', ...data };
        return sessionRecord;
      },
      updateAutomationSession: async (_id: string, data: any) => {
        if (sessionRecord) {
          Object.assign(sessionRecord, data);
        }
        return sessionRecord;
      },
      findActiveSessionByCaseId: async () => sessionRecord,
    };

    const mockContextLoader: any = {
      loadContextAndApplicants: async () => {
        const c = await mockRepo.findCaseById(caseId);
        return {
          bookingCase: c,
          context: {
            caseId,
            correlationId: 'corr_otp_1',
            applicantCount: 1,
            providerAccountId: 'acc_vfs_1',
            providerRoute: {
              id: 'route_eg_gr',
              providerCode: ProviderCode.VFS,
              sourceCountry: 'EG',
              destinationCountry: 'GR',
              applicationCentre: 'Cairo',
              visaCategory: 'Short Stay',
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
          applicants: [],
        };
      },
    };

    const adapterRegistry = new ProviderAdapterRegistryService();
    adapterRegistry.register(ProviderCode.VFS, adapter);

    const sessionService = new AutomationSessionService(mockRepo, workerId);
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

    const res = await availWorker.processJob({
      id: 'job_otp',
      data: {
        version: 1,
        jobType: 'AVAILABILITY_CHECK',
        caseId,
        correlationId: 'corr_otp_1',
        cycleId: 'cycle_1',
        idempotencyKey: 'idem_otp_1',
        expectedStatuses: [BookingCaseStatus.READY],
        createdAt: new Date().toISOString(),
      },
    } as any);

    expect(res.outcome).toBe('HUMAN_ACTION_REQUIRED');
    expect(sessionRecord.humanActionType).toBe('OTP');
  });

  it('verifies encrypted session storage: storageStateEncrypted cannot be parsed as raw JSON, but decrypts cleanly', async () => {
    const rawStorageState = JSON.stringify({ cookies: [{ name: 'vfs_synth_tok', value: 'secret123' }] });
    const mockRepo: any = {
      createAutomationSession: async (data: any) => data,
    };
    const sessionService = new AutomationSessionService(mockRepo, workerId);

    const created = await sessionService.createSession({
      bookingCaseId: 'case_crypto_test',
      providerCode: ProviderCode.VFS,
      storageStateJson: rawStorageState,
    });

    // Verify it cannot be parsed as raw JSON
    expect(() => JSON.parse(created.storageStateEncrypted!)).toThrow();

    // Verify decryption restores exact raw state
    const decrypted = decrypt(created.storageStateEncrypted!);
    expect(decrypted).toBe(rawStorageState);
  });
});

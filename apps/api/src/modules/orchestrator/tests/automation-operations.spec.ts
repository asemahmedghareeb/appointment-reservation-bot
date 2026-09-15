import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomationOperationsService } from '../services/automation-operations.service.js';
import { BookingCaseStatus, prisma } from '@visaflow/database';
import { ProviderCode } from '@visaflow/shared-types';
import { ProviderAccountRequiredError, ProviderAccountMismatchError } from '../errors/provider-account.errors.js';
import { AutomationSessionNotFoundError, AutomationSessionConflictError } from '../errors/automation-session.errors.js';
import { BadRequestException } from '@nestjs/common';

describe('AutomationOperationsService Unit Tests', () => {
  let service: AutomationOperationsService;
  let mockQueueService: any;

  const validCase: any = {
    id: 'case_ops_1',
    status: BookingCaseStatus.READY,
    providerAccountId: 'acc_valid_1',
    providerRoute: {
      providerId: 'prov_vfs',
      provider: { code: ProviderCode.VFS },
    },
    bookingApplicants: [{ id: 'app_1' }],
  };

  const validAccount: any = {
    id: 'acc_valid_1',
    providerId: 'prov_vfs',
    active: true,
  };

  beforeEach(() => {
    mockQueueService = {
      enqueueAvailabilityCheck: vi.fn().mockResolvedValue({ jobId: 'job_avail_1', queueName: 'availability-check' }),
      enqueueSessionResume: vi.fn().mockResolvedValue({ jobId: 'job_resume_1', queueName: 'session-resume' }),
    };

    vi.spyOn(prisma.providerAccount, 'findFirst').mockResolvedValue(null as any);

    service = new AutomationOperationsService(mockQueueService);
  });

  it('startAutomation: rejects case when status is not READY', async () => {
    vi.spyOn(prisma.bookingCase, 'findUnique').mockResolvedValueOnce({
      ...validCase,
      status: BookingCaseStatus.DRAFT,
    } as any);

    await expect(service.startAutomation('case_ops_1')).rejects.toThrow(BadRequestException);
  });

  it('startAutomation: rejects case when provider account is missing', async () => {
    vi.spyOn(prisma.bookingCase, 'findUnique').mockResolvedValueOnce({
      ...validCase,
      providerAccountId: null,
    } as any);

    await expect(service.startAutomation('case_ops_1')).rejects.toThrow(ProviderAccountRequiredError);
  });

  it('startAutomation: rejects case when provider account does not match route provider', async () => {
    vi.spyOn(prisma.bookingCase, 'findUnique').mockResolvedValueOnce(validCase as any);
    vi.spyOn(prisma.providerAccount, 'findUnique').mockResolvedValueOnce({
      ...validAccount,
      providerId: 'prov_other',
    } as any);

    await expect(service.startAutomation('case_ops_1')).rejects.toThrow(ProviderAccountMismatchError);
  });

  it('startAutomation: rejects if conflicting active session exists', async () => {
    vi.spyOn(prisma.bookingCase, 'findUnique').mockResolvedValueOnce(validCase as any);
    vi.spyOn(prisma.providerAccount, 'findUnique').mockResolvedValueOnce(validAccount as any);
    vi.spyOn(prisma.automationSession, 'findFirst').mockResolvedValueOnce({
      id: 'active_sess_1',
      status: 'ACTIVE',
    } as any);

    await expect(service.startAutomation('case_ops_1')).rejects.toThrow(AutomationSessionConflictError);
  });

  it('startAutomation: enqueues availability-check job when valid', async () => {
    vi.spyOn(prisma.bookingCase, 'findUnique').mockResolvedValueOnce(validCase as any);
    vi.spyOn(prisma.providerAccount, 'findUnique').mockResolvedValueOnce(validAccount as any);
    vi.spyOn(prisma.automationSession, 'findFirst').mockResolvedValueOnce(null);

    const res = await service.startAutomation('case_ops_1');
    expect(res.success).toBe(true);
    expect(res.enqueuedJob).toBe('availability-check');
    expect(mockQueueService.enqueueAvailabilityCheck).toHaveBeenCalledWith(expect.objectContaining({
      caseId: 'case_ops_1',
      payload: { applicantCount: 1 },
    }));
  });

  it('resumeAutomation: rejects if case is not HUMAN_VERIFICATION_REQUIRED', async () => {
    vi.spyOn(prisma.bookingCase, 'findUnique').mockResolvedValueOnce({
      ...validCase,
      status: BookingCaseStatus.AUTHENTICATING,
    } as any);

    await expect(service.resumeAutomation('case_ops_1')).rejects.toThrow(BadRequestException);
  });

  it('resumeAutomation: rejects if no session found', async () => {
    vi.spyOn(prisma.bookingCase, 'findUnique').mockResolvedValueOnce({
      ...validCase,
      status: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    } as any);
    vi.spyOn(prisma.automationSession, 'findFirst').mockResolvedValueOnce(null);

    await expect(service.resumeAutomation('case_ops_1')).rejects.toThrow(AutomationSessionNotFoundError);
  });

  it('resumeAutomation: enqueues session-resume when valid', async () => {
    vi.spyOn(prisma.bookingCase, 'findUnique').mockResolvedValueOnce({
      ...validCase,
      status: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    } as any);
    vi.spyOn(prisma.automationSession, 'findFirst').mockResolvedValueOnce({
      id: 'sess_1',
      workerId: 'worker_1',
      status: 'HUMAN_ACTION_REQUIRED',
      resumeToStatus: BookingCaseStatus.AUTHENTICATING,
      humanActionType: 'CAPTCHA',
    } as any);

    const res = await service.resumeAutomation('case_ops_1');
    expect(res.success).toBe(true);
    expect(res.enqueuedJob).toBe('session-resume');
    expect(mockQueueService.enqueueSessionResume).toHaveBeenCalled();
  });

  it('getSession: returns safe operational metadata without secrets or storage state', async () => {
    vi.spyOn(prisma.automationSession, 'findFirst').mockResolvedValueOnce({
      id: 'sess_meta_1',
      bookingCaseId: 'case_ops_1',
      status: 'HUMAN_ACTION_REQUIRED',
      workerId: 'worker-1',
      humanActionType: 'CAPTCHA',
      resumeToStatus: BookingCaseStatus.AUTHENTICATING,
      currentPath: '/login',
      storageStateEncrypted: 'SENSITIVE_STORAGE_ENCRYPTED_STRING',
      expiresAt: new Date(),
      lastHeartbeatAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const session = await service.getSession('case_ops_1');
    expect(session.id).toBe('sess_meta_1');
    expect(session.humanActionType).toBe('CAPTCHA');
    // Ensure sensitive storage state is NEVER leaked in API response
    expect((session as any).storageStateEncrypted).toBeUndefined();
    expect((session as any).cookies).toBeUndefined();
    expect((session as any).password).toBeUndefined();
  });
});

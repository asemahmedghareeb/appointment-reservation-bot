import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, BookingCaseStatus } from '@visaflow/database';
import { ProviderCode } from '@visaflow/shared-types';
import { OrchestrationQueueService } from '../infrastructure/queues/orchestration-queue.service.js';
import { ProviderAccountRequiredError, ProviderAccountMismatchError } from '../errors/provider-account.errors.js';
import { AutomationSessionNotFoundError, AutomationSessionConflictError } from '../errors/automation-session.errors.js';
import type { StartAutomationDto } from '../dto/start-automation.dto.js';
import type { ResumeAutomationDto } from '../dto/resume-automation.dto.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AutomationOperationsService {
  constructor(private readonly queueService: OrchestrationQueueService) {}

  async startAutomation(caseId: string, dto?: StartAutomationDto) {
    const bookingCase = await prisma.bookingCase.findUnique({
      where: { id: caseId },
      include: {
        providerRoute: {
          include: { provider: true },
        },
        providerAccount: true,
        bookingApplicants: true,
      },
    });

    if (!bookingCase) {
      throw new NotFoundException(`BookingCase ${caseId} not found`);
    }

    // 1. Must be READY
    if (bookingCase.status !== BookingCaseStatus.READY) {
      throw new BadRequestException(
        `Case ${caseId} must be in READY status to start automation. Current status: ${bookingCase.status}`,
      );
    }

    // 2. Provider route must be VFS
    if (bookingCase.providerRoute.provider.code !== ProviderCode.VFS) {
      throw new BadRequestException(
        `Phase 3 automation supports VFS provider only. Found: ${bookingCase.providerRoute.provider.code}`,
      );
    }

    // 3. Provider account assignment
    let targetAccountId = dto?.providerAccountId ?? bookingCase.providerAccountId;
    if (!targetAccountId) {
      const defaultAccount = await prisma.providerAccount.findFirst({
        where: {
          providerId: bookingCase.providerRoute.providerId,
          active: true,
        },
      });
      if (defaultAccount) {
        targetAccountId = defaultAccount.id;
      } else {
        throw new ProviderAccountRequiredError(caseId);
      }
    }

    const account = await prisma.providerAccount.findUnique({
      where: { id: targetAccountId },
    });

    if (!account || !account.active) {
      throw new ProviderAccountRequiredError(caseId);
    }

    if (account.providerId !== bookingCase.providerRoute.providerId) {
      throw new ProviderAccountMismatchError(
        `ProviderAccount ${targetAccountId} does not belong to provider ${bookingCase.providerRoute.providerId}`,
      );
    }

    if (bookingCase.providerAccountId !== targetAccountId) {
      await prisma.bookingCase.update({
        where: { id: caseId },
        data: { providerAccountId: targetAccountId },
      });
    }

    // 4. Check for conflicting active automation session
    const existingActiveSession = await prisma.automationSession.findFirst({
      where: {
        bookingCaseId: caseId,
        status: { in: ['STARTING', 'ACTIVE', 'HUMAN_ACTION_REQUIRED', 'PAYMENT_HANDOFF'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingActiveSession) {
      const checkpoint = (existingActiveSession.checkpointJson as Record<string, any>) || {};
      const isPrepared = checkpoint.step === 'LOGIN_REQUIRED' || checkpoint.step === 'READY_FOR_AUTOMATION' || checkpoint.authenticated === true;
      if (!isPrepared) {
        throw new AutomationSessionConflictError(caseId, { sessionId: existingActiveSession.id });
      }
      // Renew session TTL
      await prisma.automationSession.update({
        where: { id: existingActiveSession.id },
        data: {
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          lastHeartbeatAt: new Date(),
        },
      });
    }

    // 5. Enqueue availability-check job
    const correlationId = `corr_${randomUUID()}`;
    const cycleId = `cycle_${Date.now()}`;
    const idempotencyKey = `${caseId}:avail:${cycleId}`;

    const { jobId, queueName } = await this.queueService.enqueueAvailabilityCheck({
      caseId,
      correlationId,
      cycleId,
      idempotencyKey,
      payload: {
        applicantCount: bookingCase.bookingApplicants.length || 1,
      },
    });

    return {
      success: true,
      caseId,
      status: bookingCase.status,
      jobId,
      queueName,
      enqueuedJob: 'availability-check',
    };
  }

  async resumeAutomation(caseId: string, _dto?: ResumeAutomationDto) {
    const bookingCase = await prisma.bookingCase.findUnique({
      where: { id: caseId },
    });

    if (!bookingCase) {
      throw new NotFoundException(`BookingCase ${caseId} not found`);
    }

    if (bookingCase.status !== BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED) {
      throw new BadRequestException(
        `Cannot resume automation for case ${caseId} with status ${bookingCase.status}. Expected HUMAN_VERIFICATION_REQUIRED.`,
      );
    }

    const session = await prisma.automationSession.findFirst({
      where: {
        bookingCaseId: caseId,
        status: { in: ['HUMAN_ACTION_REQUIRED', 'ACTIVE', 'PAYMENT_HANDOFF'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new AutomationSessionNotFoundError(caseId);
    }

    const correlationId = `corr_${randomUUID()}`;
    const cycleId = `cycle_${Date.now()}`;
    const idempotencyKey = `${caseId}:resume:${cycleId}`;

    const { jobId, queueName } = await this.queueService.enqueueSessionResume({
      caseId,
      correlationId,
      cycleId,
      idempotencyKey,
      payload: {
        resumeToStatus: (session.resumeToStatus as any) ?? BookingCaseStatus.AUTHENTICATING,

        actionType: (session.humanActionType as any) ?? ('CAPTCHA' as any),
        ...(session.checkpointJson ? { checkpoint: session.checkpointJson as Record<string, unknown> } : {}),
      },
    });


    return {
      success: true,
      caseId,
      status: bookingCase.status,
      sessionId: session.id,
      workerId: session.workerId,
      jobId,
      queueName,
      enqueuedJob: 'session-resume',
    };
  }

  async getSession(caseId: string) {
    const session = await prisma.automationSession.findFirst({
      where: { bookingCaseId: caseId },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new AutomationSessionNotFoundError(caseId);
    }

    // Return safe operational metadata ONLY. Never expose storageStateEncrypted, cookies, passwords, or tokens.
    return {
      id: session.id,
      bookingCaseId: session.bookingCaseId,
      status: session.status,
      workerId: session.workerId,
      humanActionType: session.humanActionType,
      resumeToStatus: session.resumeToStatus,
      currentPath: session.currentPath,
      expiresAt: session.expiresAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async prepareLoginSession(caseId: string) {
    const bookingCase = await prisma.bookingCase.findUnique({
      where: { id: caseId },
      include: {
        providerRoute: {
          include: { provider: true },
        },
        providerAccount: true,
        bookingApplicants: true,
      },
    });

    if (!bookingCase) {
      throw new NotFoundException(`BookingCase ${caseId} not found`);
    }

    if (bookingCase.providerRoute.provider.code !== ProviderCode.VFS) {
      throw new BadRequestException(
        `Manual login preparation supports VFS provider only. Found: ${bookingCase.providerRoute.provider.code}`,
      );
    }

    // Provider account assignment if missing
    let targetAccountId = bookingCase.providerAccountId;
    if (!targetAccountId) {
      const defaultAccount = await prisma.providerAccount.findFirst({
        where: {
          providerId: bookingCase.providerRoute.providerId,
          active: true,
        },
      });
      if (defaultAccount) {
        targetAccountId = defaultAccount.id;
        await prisma.bookingCase.update({
          where: { id: caseId },
          data: { providerAccountId: targetAccountId },
        });
      }
    }

    // Check if a session is already present or create a new prepared session
    let session = await prisma.automationSession.findFirst({
      where: {
        bookingCaseId: caseId,
        status: { in: ['STARTING', 'ACTIVE', 'HUMAN_ACTION_REQUIRED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      session = await prisma.automationSession.create({
        data: {
          bookingCaseId: caseId,
          providerAccountId: targetAccountId,
          providerCode: bookingCase.providerRoute.provider.code as any,
          workerId: 'worker-1',
          status: 'STARTING',
          humanActionType: 'LOGIN',
          checkpointJson: {
            step: 'LOGIN_REQUIRED',
            authenticated: false,
          },
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
    } else {
      // Renew TTL and ensure checkpoint has login state
      await prisma.automationSession.update({
        where: { id: session.id },
        data: {
          status: session.status === 'ACTIVE' ? 'ACTIVE' : 'STARTING',
          humanActionType: 'LOGIN',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          lastHeartbeatAt: new Date(),
        },
      });
    }

    // Enqueue prepare-login job to worker
    const correlationId = `corr_${randomUUID()}`;
    const cycleId = `cycle_${Date.now()}`;
    const idempotencyKey = `${caseId}:prep:${cycleId}`;

    const { jobId, queueName } = await this.queueService.enqueuePrepareLogin({
      caseId,
      correlationId,
      cycleId,
      idempotencyKey,
      payload: {
        applicantCount: bookingCase.bookingApplicants.length || 1,
      },
    });

    return {
      success: true,
      caseId,
      sessionId: session.id,
      jobId,
      queueName,
      status: 'LOGIN_REQUIRED',
    };
  }

  async getAuthStatus(caseId: string) {
    const session = await prisma.automationSession.findFirst({
      where: { bookingCaseId: caseId },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return {
        hasSession: false,
        authenticated: false,
        status: 'NO_SESSION',
      };
    }

    const checkpoint = (session.checkpointJson as Record<string, any>) || {};
    const isAuthenticated = checkpoint.authenticated === true;

    return {
      hasSession: true,
      sessionId: session.id,
      sessionStatus: session.status,
      authenticated: isAuthenticated,
      humanActionType: session.humanActionType,
      expiresAt: session.expiresAt,
    };
  }
}

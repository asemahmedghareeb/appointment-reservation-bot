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
    });

    if (existingActiveSession) {
      throw new AutomationSessionConflictError(caseId, { sessionId: existingActiveSession.id });
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
}

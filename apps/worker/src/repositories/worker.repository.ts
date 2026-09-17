import {
  prisma,
  BookingCaseStatus,
  StateActorType,
  type Prisma,
  type AutomationSessionStatus,
  type PaymentHandoffStatus,
} from '@visaflow/database';

export const workerCaseInclude = {
  providerRoute: {
    include: {
      provider: true,
    },
  },
  providerAccount: true,
  bookingApplicants: {
    include: {
      applicant: true,
    },
    orderBy: { position: 'asc' as const },
  },
} as const;

export type WorkerBookingCase = Prisma.BookingCaseGetPayload<{
  include: typeof workerCaseInclude;
}>;

export class WorkerRepository {
  async findCaseById(caseId: string): Promise<WorkerBookingCase | null> {
    return prisma.bookingCase.findUnique({
      where: { id: caseId },
      include: workerCaseInclude,
    });
  }

  async findProviderAccount(accountId: string) {
    return prisma.providerAccount.findUnique({
      where: { id: accountId },
    });
  }

  async atomicConditionalTransition(params: {
    caseId: string;
    fromStatus: BookingCaseStatus;
    toStatus: BookingCaseStatus;
    actorType: StateActorType;
    actorId?: string | null | undefined;
    reason?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
  }): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.bookingCase.updateMany({
        where: {
          id: params.caseId,
          status: params.fromStatus,
        },
        data: {
          status: params.toStatus,
        },
      });

      if (result.count === 0) {
        return false;
      }

      await tx.bookingCaseStateHistory.create({
        data: {
          bookingCaseId: params.caseId,
          fromStatus: params.fromStatus,
          toStatus: params.toStatus,
          actorType: params.actorType,
          actorId: params.actorId ?? null,
          reason: params.reason ?? null,
          metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });

      await tx.activityLog.create({
        data: {
          bookingCaseId: params.caseId,
          actorType: params.actorType,
          actorId: params.actorId ?? null,
          eventType: 'CASE_STATUS_TRANSITIONED',
          message: `Case status transitioned from ${params.fromStatus} to ${params.toStatus}`,
          metadata: {
            fromStatus: params.fromStatus,
            toStatus: params.toStatus,
          },
        },
      });

      return true;
    }, {
      maxWait: 15000,
      timeout: 20000,
    });
  }

  async createAutomationSession(data: {
    bookingCaseId: string;
    providerAccountId?: string | null | undefined;
    providerCode: any;
    workerId: string;
    status: AutomationSessionStatus;
    storageStateEncrypted?: string | null | undefined;
    humanActionType?: string | null | undefined;
    resumeToStatus?: BookingCaseStatus | null | undefined;
    checkpointJson?: Record<string, unknown> | null | undefined;
    currentPath?: string | null | undefined;
    expiresAt?: Date | null | undefined;
  }) {
    return prisma.automationSession.create({
      data: {
        bookingCaseId: data.bookingCaseId,
        providerAccountId: data.providerAccountId ?? null,
        providerCode: data.providerCode,
        workerId: data.workerId,
        status: data.status,
        storageStateEncrypted: data.storageStateEncrypted ?? null,
        humanActionType: data.humanActionType ?? null,
        resumeToStatus: data.resumeToStatus ?? null,
        checkpointJson: (data.checkpointJson as Prisma.InputJsonValue) ?? undefined,
        currentPath: data.currentPath ?? null,
        expiresAt: data.expiresAt ?? null,
      },
    });
  }

  async updateAutomationSession(
    sessionId: string,
    data: {
      status?: AutomationSessionStatus | undefined;
      storageStateEncrypted?: string | null | undefined;
      humanActionType?: string | null | undefined;
      resumeToStatus?: BookingCaseStatus | null | undefined;
      checkpointJson?: Record<string, unknown> | null | undefined;
      currentPath?: string | null | undefined;
      lastHeartbeatAt?: Date | undefined;
    },
  ) {
    return prisma.automationSession.update({
      where: { id: sessionId },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.storageStateEncrypted !== undefined ? { storageStateEncrypted: data.storageStateEncrypted } : {}),
        ...(data.humanActionType !== undefined ? { humanActionType: data.humanActionType } : {}),
        ...(data.resumeToStatus !== undefined ? { resumeToStatus: data.resumeToStatus } : {}),
        ...(data.checkpointJson !== undefined ? { checkpointJson: data.checkpointJson as Prisma.InputJsonValue } : {}),
        ...(data.currentPath !== undefined ? { currentPath: data.currentPath } : {}),
        ...(data.lastHeartbeatAt ? { lastHeartbeatAt: data.lastHeartbeatAt } : {}),
      },
    });
  }

  async findActiveSessionByCaseId(caseId: string) {
    return prisma.automationSession.findFirst({
      where: {
        bookingCaseId: caseId,
        status: {
          in: ['STARTING', 'ACTIVE', 'HUMAN_ACTION_REQUIRED', 'PAYMENT_HANDOFF'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPaymentHandoff(data: {
    bookingCaseId: string;
    automationSessionId?: string | null | undefined;
    status: PaymentHandoffStatus;
    amount?: number | null | undefined;
    currency?: string | null | undefined;
    externalReference?: string | null | undefined;
    deadlineAt?: Date | null | undefined;
    safePaymentPath?: string | null | undefined;
  }) {
    return prisma.paymentHandoff.create({
      data: {
        bookingCaseId: data.bookingCaseId,
        automationSessionId: data.automationSessionId ?? null,
        status: data.status,
        amount: data.amount ?? null,
        currency: data.currency ?? null,
        externalReference: data.externalReference ?? null,
        deadlineAt: data.deadlineAt ?? null,
        safePaymentPath: data.safePaymentPath ?? null,
      },
    });
  }

  async createNotification(data: {
    userId?: string | null | undefined;
    bookingCaseId?: string | null | undefined;
    type: string;
    title: string;
    message: string;
  }) {
    return prisma.notification.create({
      data: {
        userId: data.userId ?? null,
        bookingCaseId: data.bookingCaseId ?? null,
        type: data.type,
        title: data.title,
        message: data.message,
      },
    });
  }

  async recordActivityLog(data: {
    bookingCaseId: string;
    actorType: string;
    actorId?: string | null | undefined;
    eventType: string;
    message: string;
    metadata?: Record<string, unknown> | null | undefined;
  }) {
    return prisma.activityLog.create({
      data: {
        bookingCaseId: data.bookingCaseId,
        actorType: data.actorType as any,
        actorId: data.actorId ?? null,
        eventType: data.eventType,
        message: data.message,
        metadata: (data.metadata as any) ?? undefined,
      },
    });
  }
}

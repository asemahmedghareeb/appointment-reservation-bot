import { Injectable } from '@nestjs/common';
import {
  prisma,
  type BookingCase,
  type BookingCaseStateHistory,
  type Prisma,
  type BookingCaseStatus,
  type StateActorType,
} from '@visaflow/database';
import { StaleCaseStateError } from '../errors/stale-case-state.error.js';

export const orchestratorCaseInclude = {
  providerRoute: {
    include: {
      provider: {
        select: { code: true, name: true },
      },
    },
  },
  bookingApplicants: {
    include: {
      applicant: true,
    },
    orderBy: { position: 'asc' as const },
  },
} as const;

export type OrchestratorBookingCase = Prisma.BookingCaseGetPayload<{
  include: typeof orchestratorCaseInclude;
}>;

export interface AtomicTransitionParams {
  caseId: string;
  fromStatus: BookingCaseStatus;
  toStatus: BookingCaseStatus;
  actorType: StateActorType;
  actorId?: string | null | undefined;
  reason?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
}

@Injectable()
export class OrchestratorRepository {
  async findCaseById(caseId: string): Promise<OrchestratorBookingCase | null> {
    return prisma.bookingCase.findUnique({
      where: { id: caseId },
      include: orchestratorCaseInclude,
    });
  }

  async getLatestStateHistory(caseId: string): Promise<BookingCaseStateHistory | null> {
    return prisma.bookingCaseStateHistory.findFirst({
      where: { bookingCaseId: caseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async atomicStatusTransition(params: AtomicTransitionParams): Promise<BookingCase> {
    return prisma.$transaction(async (tx) => {
      // 1. Optimistic / conditional compare-and-set
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
        const actual = await tx.bookingCase.findUnique({
          where: { id: params.caseId },
          select: { status: true },
        });
        throw new StaleCaseStateError(params.caseId, params.fromStatus, actual?.status);
      }

      // 2. Append-only state history
      await tx.bookingCaseStateHistory.create({
        data: {
          bookingCaseId: params.caseId,
          fromStatus: params.fromStatus,
          toStatus: params.toStatus,
          actorType: params.actorType,
          actorId: params.actorId ?? null,
          reason: params.reason ?? null,
          metadata: (params.metadata as any) ?? undefined,
        },
      });

      // 3. Append-only activity log
      await tx.activityLog.create({
        data: {
          bookingCaseId: params.caseId,
          actorType: params.actorType,
          actorId: params.actorId ?? null,
          eventType: 'CASE_STATUS_TRANSITIONED',
          message: `Booking case transitioned from ${params.fromStatus} to ${params.toStatus}${
            params.reason ? `: ${params.reason}` : ''
          }`,
          metadata: {
            fromStatus: params.fromStatus,
            toStatus: params.toStatus,
            reason: params.reason,
          },
        },
      });

      const updated = await tx.bookingCase.findUniqueOrThrow({
        where: { id: params.caseId },
      });

      return updated;
    }, { maxWait: 15000, timeout: 30000 });
  }
}

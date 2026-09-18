import { Injectable } from '@nestjs/common';
import {
  prisma,
  BookingCaseStatus,
  StateActorType,
  type BookingCase,
  type BookingApplicant,
  type Prisma,
} from '@visaflow/database';

export const bookingCaseInclude = {
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

export type FullBookingCase = Prisma.BookingCaseGetPayload<{
  include: typeof bookingCaseInclude;
}>;

const TX_OPTIONS = { maxWait: 15000, timeout: 30000 };

@Injectable()
export class BookingCasesRepository {
  async create(data: Prisma.BookingCaseCreateInput): Promise<FullBookingCase> {
    return prisma.bookingCase.create({
      data,
      include: bookingCaseInclude,
    });
  }

  async findById(id: string): Promise<FullBookingCase | null> {
    return prisma.bookingCase.findUnique({
      where: { id },
      include: bookingCaseInclude,
    });
  }

  async findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.BookingCaseWhereInput;
    orderBy?: Prisma.BookingCaseOrderByWithRelationInput;
  }): Promise<FullBookingCase[]> {
    const args: Prisma.BookingCaseFindManyArgs = {
      skip: params.skip,
      take: params.take,
      include: bookingCaseInclude,
      orderBy: params.orderBy ?? { createdAt: 'desc' },
    };
    if (params.where) {
      args.where = params.where;
    }
    return prisma.bookingCase.findMany(args) as unknown as Promise<FullBookingCase[]>;
  }

  async count(where?: Prisma.BookingCaseWhereInput): Promise<number> {
    if (where) {
      return prisma.bookingCase.count({ where });
    }
    return prisma.bookingCase.count();
  }

  async update(id: string, data: Prisma.BookingCaseUpdateInput): Promise<FullBookingCase> {
    return prisma.bookingCase.update({
      where: { id },
      data,
      include: bookingCaseInclude,
    });
  }

  async findApplicantLink(
    bookingCaseId: string,
    applicantId: string,
  ): Promise<BookingApplicant | null> {
    return prisma.bookingApplicant.findUnique({
      where: {
        bookingCaseId_applicantId: {
          bookingCaseId,
          applicantId,
        },
      },
    });
  }

  async findApplicantLinkById(id: string): Promise<BookingApplicant | null> {
    return prisma.bookingApplicant.findUnique({ where: { id } });
  }

  async addApplicant(
    data: Prisma.BookingApplicantCreateInput,
    unsetOtherPrimaries = false,
  ): Promise<BookingApplicant> {
    const caseId = data.bookingCase.connect?.id;
    if (unsetOtherPrimaries && caseId) {
      return prisma.$transaction(async (tx) => {
        await tx.bookingApplicant.updateMany({
          where: { bookingCaseId: caseId, isPrimary: true },
          data: { isPrimary: false },
        });

        return tx.bookingApplicant.create({ data });
      }, TX_OPTIONS);
    }

    return prisma.bookingApplicant.create({ data });
  }

  async setPrimaryApplicant(bookingCaseId: string, targetBookingApplicantId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Unset current primary
      await tx.bookingApplicant.updateMany({
        where: { bookingCaseId, isPrimary: true },
        data: { isPrimary: false },
      });

      // 2. Set new primary
      await tx.bookingApplicant.update({
        where: { id: targetBookingApplicantId },
        data: { isPrimary: true },
      });
    }, TX_OPTIONS);
  }

  async reorderApplicants(
    bookingCaseId: string,
    reorderItems: { bookingApplicantId: string; position: number }[],
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Temporary offset positions to avoid unique constraint collisions during batch updates
      const offset = 10000;
      for (const item of reorderItems) {
        await tx.bookingApplicant.update({
          where: { id: item.bookingApplicantId },
          data: { position: item.position + offset },
        });
      }

      // Assign target final positions
      for (const item of reorderItems) {
        await tx.bookingApplicant.update({
          where: { id: item.bookingApplicantId },
          data: { position: item.position },
        });
      }
    }, TX_OPTIONS);
  }

  async removeApplicant(bookingApplicantId: string): Promise<BookingApplicant> {
    return prisma.bookingApplicant.delete({
      where: { id: bookingApplicantId },
    });
  }

  async transitionToReady(params: {
    caseId: string;
    actorId?: string;
    reason?: string;
  }): Promise<FullBookingCase> {
    return prisma.$transaction(async (tx) => {
      // 1. Update BookingCase status to READY
      const updatedCase = await tx.bookingCase.update({
        where: { id: params.caseId },
        data: { status: BookingCaseStatus.READY },
        include: bookingCaseInclude,
      });

      // 2. Append BookingCaseStateHistory
      await tx.bookingCaseStateHistory.create({
        data: {
          bookingCase: { connect: { id: params.caseId } },
          fromStatus: BookingCaseStatus.DRAFT,
          toStatus: BookingCaseStatus.READY,
          actorType: StateActorType.USER,
          actorId: params.actorId ?? null,
          reason: params.reason || 'Case marked READY for automated slot processing',
        },
      });

      // 3. Append ActivityLog
      await tx.activityLog.create({
        data: {
          bookingCaseId: params.caseId,
          actorType: StateActorType.USER,
          actorId: params.actorId ?? null,
          eventType: 'BOOKING_CASE_READY',
          message: `Booking case ${updatedCase.caseNumber} transitioned from DRAFT to READY`,
        },
      });

      return updatedCase;
    }, TX_OPTIONS);
  }

  async delete(id: string): Promise<void> {
    await prisma.$transaction([
      prisma.bookingApplicant.deleteMany({ where: { bookingCaseId: id } }),
      prisma.bookingCaseStateHistory.deleteMany({ where: { bookingCaseId: id } }),
      prisma.activityLog.deleteMany({ where: { bookingCaseId: id } }),
      prisma.automationSession.deleteMany({ where: { bookingCaseId: id } }),
      prisma.paymentHandoff.deleteMany({ where: { bookingCaseId: id } }),
      prisma.notification.deleteMany({ where: { bookingCaseId: id } }),
      prisma.bookingCase.delete({ where: { id } }),
    ]);
  }
}

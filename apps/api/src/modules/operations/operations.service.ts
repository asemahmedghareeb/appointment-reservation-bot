import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { prisma, BookingCaseStatus as PrismaBookingCaseStatus } from '@visaflow/database';
import { decrypt, maskPassportNumber } from '@visaflow/crypto';
import {
  BookingCaseStatus,
  type OperationsCaseDetail,
  type CaseTimelineItem,
  type AttentionItem,
  type OperationsCaseApplicant,
  type ProviderCode,
} from '@visaflow/shared-types';

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  async getCaseDetail(caseId: string): Promise<OperationsCaseDetail> {
    const bookingCase = await prisma.bookingCase.findUnique({
      where: { id: caseId },
      include: {
        providerRoute: {
          include: {
            provider: true,
          },
        },
        providerAccount: {
          select: {
            id: true,
            label: true,
            username: true,
          },
        },
        bookingApplicants: {
          include: {
            applicant: {
              include: {
                client: true,
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
        },
        automationSessions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        paymentHandoffs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!bookingCase) {
      throw new NotFoundException(`Booking case with ID ${caseId} not found`);
    }

    // Safely decrypt and mask applicants
    const applicants: OperationsCaseApplicant[] = bookingCase.bookingApplicants.map((ba) => {
      let masked = 'UNKNOWN';
      try {
        const decrypted = decrypt(ba.applicant.passportNumberEncrypted);
        masked = maskPassportNumber(decrypted);
      } catch (err) {
        this.logger.warn(`Failed to decrypt/mask passport for applicant ${ba.applicantId}: ${err}`);
      }

      return {
        id: ba.id,
        applicantId: ba.applicantId,
        position: ba.position,
        relation: ba.relation,
        isPrimary: ba.isPrimary,
        firstName: ba.applicant.firstName,
        lastName: ba.applicant.lastName,
        gender: ba.applicant.gender,
        dateOfBirth: ba.applicant.dateOfBirth.toISOString().split('T')[0] ?? '',
        nationality: ba.applicant.nationality,
        passportMasked: masked,
        passportExpiry: ba.applicant.passportExpiry.toISOString().split('T')[0] ?? '',
      };
    });

    const latestSession = bookingCase.automationSessions[0];
    const latestPayment = bookingCase.paymentHandoffs[0];
    const primaryApplicant = bookingCase.bookingApplicants.find((a) => a.isPrimary) ?? bookingCase.bookingApplicants[0];
    const clientEntity = primaryApplicant?.applicant?.client;

    return {
      id: bookingCase.id,
      caseNumber: bookingCase.caseNumber,
      status: bookingCase.status as unknown as BookingCaseStatus,
      bookingMode: bookingCase.bookingMode,
      preferredDateFrom: bookingCase.preferredDateFrom ? bookingCase.preferredDateFrom.toISOString().split('T')[0] : null,
      preferredDateTo: bookingCase.preferredDateTo ? bookingCase.preferredDateTo.toISOString().split('T')[0] : null,
      preferredTime: bookingCase.preferredTime ?? null,
      allowGroupSplit: bookingCase.allowGroupSplit,
      provider: {
        code: bookingCase.providerRoute.provider.code as unknown as ProviderCode,
        name: bookingCase.providerRoute.provider.name,
        sourceCountry: bookingCase.providerRoute.sourceCountry,
        destinationCountry: bookingCase.providerRoute.destinationCountry,
        applicationCentre: bookingCase.providerRoute.applicationCentre,
        visaCategory: bookingCase.providerRoute.visaCategory,
        visaSubcategory: bookingCase.providerRoute.visaSubcategory,
      },
      providerAccount: bookingCase.providerAccount
        ? {
            id: bookingCase.providerAccount.id,
            label: bookingCase.providerAccount.label,
            username: bookingCase.providerAccount.username,
          }
        : null,
      client: clientEntity
        ? {
            id: clientEntity.id,
            name: clientEntity.fullName,
            email: clientEntity.email,
            phone: clientEntity.phone,
          }
        : null,
      applicants,
      automationSession: latestSession
        ? {
            id: latestSession.id,
            status: latestSession.status,
            humanActionType: latestSession.humanActionType,
            resumeToStatus: latestSession.resumeToStatus
              ? (latestSession.resumeToStatus as unknown as BookingCaseStatus)
              : null,
            currentPath: latestSession.currentPath,
            expiresAt: latestSession.expiresAt?.toISOString() ?? null,
            checkpointJson: (latestSession.checkpointJson as Record<string, any>) ?? null,
          }
        : null,
      appointment: null,
      paymentHandoff: latestPayment
        ? {
            id: latestPayment.id,
            amount: latestPayment.amount ? Number(latestPayment.amount) : null,
            currency: latestPayment.currency,
            safePaymentPath: latestPayment.safePaymentPath,
            status: latestPayment.status,
            deadlineAt: latestPayment.deadlineAt?.toISOString() ?? null,
          }
        : null,
      createdAt: bookingCase.createdAt.toISOString(),
      updatedAt: bookingCase.updatedAt.toISOString(),
    };
  }

  async getCaseTimeline(caseId: string): Promise<CaseTimelineItem[]> {
    const [stateHistories, activityLogs] = await Promise.all([
      prisma.bookingCaseStateHistory.findMany({
        where: { bookingCaseId: caseId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.findMany({
        where: { bookingCaseId: caseId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const timeline: CaseTimelineItem[] = [];

    for (const sh of stateHistories) {
      timeline.push({
        id: `sh-${sh.id}`,
        timestamp: sh.createdAt.toISOString(),
        type: 'STATE_TRANSITION',
        title: `Status changed to ${sh.toStatus}`,
        description: sh.reason ?? undefined,
        actorType: sh.actorType,
        fromStatus: sh.fromStatus ? (sh.fromStatus as unknown as BookingCaseStatus) : undefined,
        toStatus: sh.toStatus as unknown as BookingCaseStatus,
      });
    }

    for (const log of activityLogs) {
      timeline.push({
        id: `act-${log.id}`,
        timestamp: log.createdAt.toISOString(),
        type: log.eventType,
        title: log.message,
        actorType: 'SYSTEM',
      });
    }

    // Sort all events chronologically descending
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return timeline;
  }

  async getAttentionList(limit = 50): Promise<AttentionItem[]> {
    const cases = await prisma.bookingCase.findMany({
      where: {
        status: {
          in: [
            PrismaBookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
            PrismaBookingCaseStatus.PAYMENT_REQUIRED,
            PrismaBookingCaseStatus.FAILED,
          ],
        },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        providerRoute: {
          include: {
            provider: {
              select: { code: true },
            },
          },
        },
        automationSessions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        stateHistory: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = Date.now();

    return cases.map((c) => {
      const latestHistory = c.stateHistory[0];
      const latestSession = c.automationSessions[0];
      const triggeredAtDate = latestHistory?.createdAt ?? c.updatedAt;
      const ageSeconds = Math.max(0, Math.floor((now - triggeredAtDate.getTime()) / 1000));

      let reason = 'Operator action required';
      if (c.status === PrismaBookingCaseStatus.HUMAN_VERIFICATION_REQUIRED) {
        reason = latestSession?.humanActionType
          ? `${latestSession.humanActionType} verification required`
          : 'Human challenge verification required';
      } else if (c.status === PrismaBookingCaseStatus.PAYMENT_REQUIRED) {
        reason = 'Provider payment step reached; manual completion required';
      } else if (c.status === PrismaBookingCaseStatus.FAILED) {
        reason = latestHistory?.reason ?? 'Automation encountered failure';
      }

      return {
        caseId: c.id,
        caseNumber: c.caseNumber,
        provider: c.providerRoute.provider.code as unknown as ProviderCode,
        destination: c.providerRoute.destinationCountry,
        centre: c.providerRoute.applicationCentre,
        reason,
        currentStatus: c.status as unknown as BookingCaseStatus,
        humanActionType: latestSession?.humanActionType ?? undefined,
        ageSeconds,
        triggeredAt: triggeredAtDate.toISOString(),
      };
    });
  }
}

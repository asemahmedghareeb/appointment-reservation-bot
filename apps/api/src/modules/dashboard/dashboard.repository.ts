import { Injectable } from '@nestjs/common';
import { prisma, BookingCaseStatus } from '@visaflow/database';
import type { DashboardCounts, AttentionItem, RecentActivityItem } from '@visaflow/shared-types';

@Injectable()
export class DashboardRepository {
  async getCounts(): Promise<DashboardCounts> {
    const statusGroups = await prisma.bookingCase.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    });

    const countsMap = new Map<string, number>();
    let total = 0;

    for (const group of statusGroups) {
      countsMap.set(group.status, group._count._all);
      total += group._count._all;
    }

    const monitoring = countsMap.get(BookingCaseStatus.MONITORING) ?? 0;
    const waitingQueue = countsMap.get(BookingCaseStatus.WAITING_QUEUE) ?? 0;
    const slotFound = countsMap.get(BookingCaseStatus.SLOT_FOUND) ?? 0;
    const paymentRequired = countsMap.get(BookingCaseStatus.PAYMENT_REQUIRED) ?? 0;
    const confirmed = countsMap.get(BookingCaseStatus.CONFIRMED) ?? 0;

    // Need Attention encompasses HUMAN_VERIFICATION_REQUIRED, PAYMENT_REQUIRED, and FAILED
    const humanAttention = countsMap.get(BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED) ?? 0;
    const failed = countsMap.get(BookingCaseStatus.FAILED) ?? 0;
    const needAttention = humanAttention + paymentRequired + failed;

    return {
      total,
      monitoring,
      waitingQueue,
      slotFound,
      paymentRequired,
      confirmed,
      needAttention,
    };
  }

  async getRecentActivity(limit = 10): Promise<RecentActivityItem[]> {
    const activities = await prisma.activityLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        bookingCase: {
          select: {
            id: true,
            caseNumber: true,
          },
        },
      },
    });

    return activities.map((a) => ({
      id: a.id,
      caseId: a.bookingCaseId ?? undefined,
      caseNumber: a.bookingCase?.caseNumber ?? undefined,
      eventType: a.eventType,
      message: a.message,
      timestamp: a.createdAt.toISOString(),
    }));
  }

  async getAttentionCases(limit = 10): Promise<AttentionItem[]> {
    const cases = await prisma.bookingCase.findMany({
      where: {
        status: {
          in: [
            BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
            BookingCaseStatus.PAYMENT_REQUIRED,
            BookingCaseStatus.FAILED,
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
      if (c.status === BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED) {
        reason = latestSession?.humanActionType
          ? `${latestSession.humanActionType} verification required`
          : 'Human challenge verification required';
      } else if (c.status === BookingCaseStatus.PAYMENT_REQUIRED) {
        reason = 'Provider payment step reached; manual completion required';
      } else if (c.status === BookingCaseStatus.FAILED) {
        reason = latestHistory?.reason ?? 'Automation encountered failure';
      }

      return {
        caseId: c.id,
        caseNumber: c.caseNumber,
        provider: c.providerRoute.provider.code as any,
        destination: c.providerRoute.destinationCountry,
        centre: c.providerRoute.applicationCentre,
        reason,
        currentStatus: c.status as any,
        humanActionType: latestSession?.humanActionType ?? undefined,
        ageSeconds,
        triggeredAt: triggeredAtDate.toISOString(),
      };
    });
  }
}

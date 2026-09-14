import { Injectable } from '@nestjs/common';
import { prisma, ProviderCode as DbProviderCode } from '@visaflow/database';
import {
  ProviderHealthStatus,
  type ProviderHealthReport,
} from '@visaflow/shared-types';

@Injectable()
export class ProviderHealthService {
  async getProviderHealth(providerCode: DbProviderCode = DbProviderCode.VFS): Promise<ProviderHealthReport> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Look at recent sessions for this provider in the last hour
    const recentSessions = await prisma.automationSession.findMany({
      where: {
        providerCode,
        createdAt: { gte: oneHourAgo },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Check last successful operation
    const lastSuccessfulSession = await prisma.automationSession.findFirst({
      where: {
        providerCode,
        status: { in: ['ACTIVE', 'COMPLETED', 'PAYMENT_HANDOFF'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Look at recent page change or failure activity logs
    const recentPageChangedLogs = await prisma.activityLog.count({
      where: {
        createdAt: { gte: oneHourAgo },
        eventType: 'VFS_PAGE_CHANGED',
      },
    });

    if (recentSessions.length === 0) {
      return {
        provider: providerCode as any,
        status: ProviderHealthStatus.HEALTHY,
        lastSuccessfulOperationAt: lastSuccessfulSession?.updatedAt.toISOString() ?? null,
        recentFailureRate: 0,
        activeSessions: 0,
        pageChangedErrorsRecent: recentPageChangedLogs,
      };
    }

    const failedSessions = recentSessions.filter(
      (s) => s.status === 'FAILED' || s.status === 'LOST',
    ).length;

    const failureRate = recentSessions.length > 0 ? failedSessions / recentSessions.length : 0;
    const activeSessions = recentSessions.filter(
      (s) => s.status === 'ACTIVE' || s.status === 'STARTING',
    ).length;

    let status = ProviderHealthStatus.HEALTHY;
    if (recentPageChangedLogs > 0 || failureRate > 0.5) {
      status = ProviderHealthStatus.UNHEALTHY;
    } else if (failureRate > 0.2) {
      status = ProviderHealthStatus.DEGRADED;
    }

    return {
      provider: providerCode as any,
      status,
      lastSuccessfulOperationAt: lastSuccessfulSession?.updatedAt.toISOString() ?? null,
      recentFailureRate: Math.round(failureRate * 100) / 100,
      activeSessions,
      pageChangedErrorsRecent: recentPageChangedLogs,
    };
  }

  async getAllProvidersHealth(): Promise<{ providers: ProviderHealthReport[] }> {
    const vfsHealth = await this.getProviderHealth(DbProviderCode.VFS);
    return {
      providers: [vfsHealth],
    };
  }
}

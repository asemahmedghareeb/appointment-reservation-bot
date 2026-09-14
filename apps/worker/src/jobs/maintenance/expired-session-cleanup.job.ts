import { prisma, AutomationSessionStatus } from '@visaflow/database';
import { workerLogger } from '../../observability/safe-logger.js';

export class ExpiredSessionCleanupJob {
  async runCleanup(): Promise<{ expiredCount: number }> {
    const now = new Date();

    const result = await prisma.automationSession.updateMany({
      where: {
        status: {
          in: [
            AutomationSessionStatus.STARTING,
            AutomationSessionStatus.ACTIVE,
            AutomationSessionStatus.HUMAN_ACTION_REQUIRED,
          ],
        },
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: AutomationSessionStatus.EXPIRED,
      },
    });

    if (result.count > 0) {
      workerLogger.info(`Cleaned up and expired ${result.count} stale automation sessions.`);
    }

    return { expiredCount: result.count };
  }
}

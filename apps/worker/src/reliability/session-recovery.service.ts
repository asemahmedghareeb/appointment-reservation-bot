import { prisma, AutomationSessionStatus } from '@visaflow/database';
import { workerLogger } from '../observability/safe-logger.js';

export enum SessionRecoveryCategory {
  RESTORABLE = 'RESTORABLE',
  REQUIRES_NEW_BROWSER = 'REQUIRES_NEW_BROWSER',
  HUMAN_SESSION_LOST = 'HUMAN_SESSION_LOST',
  EXPIRED = 'EXPIRED',
  INVALID = 'INVALID',
}

export interface SessionRecoveryResult {
  sessionId: string;
  caseId: string;
  category: SessionRecoveryCategory;
  details: string;
}

export class SessionRecoveryService {
  constructor(private readonly workerId: string) {}

  classifySession(session: {
    id: string;
    bookingCaseId: string;
    status: AutomationSessionStatus;
    storageStateEncrypted?: string | null | undefined;
    expiresAt?: Date | null | undefined;
  }): SessionRecoveryCategory {
    const now = new Date();

    if (session.expiresAt && session.expiresAt < now) {
      return SessionRecoveryCategory.EXPIRED;
    }

    if (session.status === AutomationSessionStatus.HUMAN_ACTION_REQUIRED) {
      // Live browser challenge cannot be faked or carried across process crash
      return SessionRecoveryCategory.HUMAN_SESSION_LOST;
    }

    if (session.storageStateEncrypted) {
      return SessionRecoveryCategory.RESTORABLE;
    }

    return SessionRecoveryCategory.REQUIRES_NEW_BROWSER;
  }

  async recoverStartupSessions(): Promise<SessionRecoveryResult[]> {
    workerLogger.info(`Scanning orphaned sessions for worker [${this.workerId}]...`);

    const orphaned = await prisma.automationSession.findMany({
      where: {
        status: {
          in: [
            AutomationSessionStatus.STARTING,
            AutomationSessionStatus.ACTIVE,
            AutomationSessionStatus.HUMAN_ACTION_REQUIRED,
          ],
        },
      },
    });

    const results: SessionRecoveryResult[] = [];

    for (const session of orphaned) {
      const category = this.classifySession(session);
      let details = '';

      if (category === SessionRecoveryCategory.EXPIRED) {
        details = 'Session expired past deadline. Marking EXPIRED.';
        await prisma.automationSession.update({
          where: { id: session.id },
          data: { status: AutomationSessionStatus.EXPIRED },
        });
      } else if (category === SessionRecoveryCategory.HUMAN_SESSION_LOST) {
        details = 'Human challenge browser process lost on restart. Marking LOST.';
        await prisma.automationSession.update({
          where: { id: session.id },
          data: { status: AutomationSessionStatus.LOST },
        });

        // Record notification
        await prisma.notification.create({
          data: {
            bookingCaseId: session.bookingCaseId,
            type: 'SESSION_LOST',
            title: 'Human Verification Session Lost',
            message: `Verification challenge session for case ${session.bookingCaseId} was lost due to worker restart. Operator re-trigger required.`,
          },
        });
      } else if (category === SessionRecoveryCategory.RESTORABLE) {
        details = 'Encrypted session state present; ready for restoration.';
      } else {
        details = 'Session requires fresh browser initialization.';
      }

      results.push({
        sessionId: session.id,
        caseId: session.bookingCaseId,
        category,
        details,
      });
    }

    workerLogger.info(`Recovered ${results.length} orphaned sessions on startup.`);
    return results;
  }
}

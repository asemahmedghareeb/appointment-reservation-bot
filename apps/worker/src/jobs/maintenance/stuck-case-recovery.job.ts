import { prisma, BookingCaseStatus as DbStatus } from '@visaflow/database';
import { BookingCaseStatus, RecoveryAction, type RecoveryCandidate } from '@visaflow/shared-types';
import { workerLogger } from '../../observability/safe-logger.js';

export interface StuckThresholdConfig {
  authenticatingMaxMs: number;
  bookingMaxMs: number;
  paymentProcessingMaxMs: number;
}

export const DEFAULT_STUCK_THRESHOLDS: StuckThresholdConfig = {
  authenticatingMaxMs: 15 * 60 * 1000, // 15 mins
  bookingMaxMs: 20 * 60 * 1000, // 20 mins
  paymentProcessingMaxMs: 30 * 60 * 1000, // 30 mins
};

export class StuckCaseRecoveryJob {
  constructor(private readonly thresholds = DEFAULT_STUCK_THRESHOLDS) {}

  async detectStuckCases(): Promise<RecoveryCandidate[]> {
    const now = Date.now();
    const candidateCases = await prisma.bookingCase.findMany({
      where: {
        status: {
          in: [
            DbStatus.AUTHENTICATING,
            DbStatus.BOOKING,
            DbStatus.ADDING_APPLICANTS,
            DbStatus.APPOINTMENT_SELECTED,
            DbStatus.PAYMENT_PROCESSING,
          ],
        },
      },
      include: {
        automationSessions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const candidates: RecoveryCandidate[] = [];

    for (const c of candidateCases) {
      const ageMs = now - c.updatedAt.getTime();
      let isStuck = false;
      let reason = '';
      let suggestedAction = RecoveryAction.MARK_NEEDS_ATTENTION;

      if (c.status === DbStatus.AUTHENTICATING && ageMs > this.thresholds.authenticatingMaxMs) {
        isStuck = true;
        reason = `Case stuck in AUTHENTICATING for ${Math.round(ageMs / 1000 / 60)} minutes.`;
        suggestedAction = RecoveryAction.MARK_NEEDS_ATTENTION;
      } else if (
        (c.status === DbStatus.BOOKING ||
          c.status === DbStatus.ADDING_APPLICANTS ||
          c.status === DbStatus.APPOINTMENT_SELECTED) &&
        ageMs > this.thresholds.bookingMaxMs
      ) {
        isStuck = true;
        reason = `Case stuck in ${c.status} for ${Math.round(ageMs / 1000 / 60)} minutes.`;
        suggestedAction = RecoveryAction.RECONCILE_REMOTE_STATE;
      } else if (c.status === DbStatus.PAYMENT_PROCESSING && ageMs > this.thresholds.paymentProcessingMaxMs) {
        isStuck = true;
        reason = `Case stuck in PAYMENT_PROCESSING for ${Math.round(ageMs / 1000 / 60)} minutes.`;
        suggestedAction = RecoveryAction.RECONCILE_REMOTE_STATE;
      }

      if (isStuck) {
        candidates.push({
          caseId: c.id,
          status: c.status as unknown as BookingCaseStatus,
          ageMs,
          automationSessionId: c.automationSessions[0]?.id,
          suggestedAction,
          reason,
        });
      }
    }

    return candidates;
  }

  async runRecoveryCycle(): Promise<{ recoveredCount: number }> {
    const candidates = await this.detectStuckCases();
    workerLogger.info(`Stuck case recovery cycle found ${candidates.length} stuck cases.`);

    let recoveredCount = 0;
    for (const cand of candidates) {
      try {
        // Re-read DB state to ensure case has not transitioned while detecting
        const current = await prisma.bookingCase.findUnique({
          where: { id: cand.caseId },
        });

        if (!current || (current.status as unknown as BookingCaseStatus) !== cand.status) {
          workerLogger.info(`Case ${cand.caseId} changed state during scan. Skipping recovery.`);
          continue;
        }

        if (cand.suggestedAction === RecoveryAction.MARK_NEEDS_ATTENTION) {
          await prisma.notification.create({
            data: {
              bookingCaseId: cand.caseId,
              type: 'STUCK_CASE',
              title: 'Stuck Automation Detected',
              message: cand.reason,
            },
          });
          recoveredCount++;
        }
      } catch (err) {
        workerLogger.error(`Failed recovering stuck case ${cand.caseId}:`, err);
      }
    }

    return { recoveredCount };
  }
}

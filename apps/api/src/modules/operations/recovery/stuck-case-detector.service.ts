import { Injectable } from '@nestjs/common';
import { prisma, BookingCaseStatus as DbStatus } from '@visaflow/database';
import {
  RecoveryAction,
  type RecoveryCandidate,
  type BookingCaseStatus,
} from '@visaflow/shared-types';

export interface StuckThresholdConfig {
  authenticatingThresholdMs: number;
  bookingThresholdMs: number;
  addingApplicantsThresholdMs: number;
  paymentProcessingThresholdMs: number;
}

export const DEFAULT_STUCK_THRESHOLDS: StuckThresholdConfig = {
  authenticatingThresholdMs: 5 * 60 * 1000,       // 5m
  bookingThresholdMs: 3 * 60 * 1000,              // 3m
  addingApplicantsThresholdMs: 3 * 60 * 1000,     // 3m
  paymentProcessingThresholdMs: 10 * 60 * 1000,   // 10m
};

@Injectable()
export class StuckCaseDetectorService {
  constructor(private readonly thresholds: StuckThresholdConfig = DEFAULT_STUCK_THRESHOLDS) {}

  async detectStuckCases(): Promise<RecoveryCandidate[]> {
    const now = Date.now();
    const candidates: RecoveryCandidate[] = [];

    const suspiciousStatuses: DbStatus[] = [
      DbStatus.AUTHENTICATING,
      DbStatus.BOOKING,
      DbStatus.ADDING_APPLICANTS,
      DbStatus.APPOINTMENT_SELECTED,
      DbStatus.PAYMENT_PROCESSING,
    ];

    const cases = await prisma.bookingCase.findMany({
      where: {
        status: { in: suspiciousStatuses },
      },
      include: {
        automationSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const c of cases) {
      const ageMs = now - c.updatedAt.getTime();
      let threshold = this.thresholds.bookingThresholdMs;

      if (c.status === DbStatus.AUTHENTICATING) {
        threshold = this.thresholds.authenticatingThresholdMs;
      } else if (c.status === DbStatus.PAYMENT_PROCESSING) {
        threshold = this.thresholds.paymentProcessingThresholdMs;
      } else if (c.status === DbStatus.ADDING_APPLICANTS) {
        threshold = this.thresholds.addingApplicantsThresholdMs;
      }

      if (ageMs > threshold) {
        const latestSession = c.automationSessions[0];
        let suggestedAction = RecoveryAction.MARK_NEEDS_ATTENTION;

        if (latestSession && latestSession.status === 'ACTIVE') {
          suggestedAction = RecoveryAction.INSPECT_SESSION;
        } else if (c.status === DbStatus.PAYMENT_PROCESSING) {
          suggestedAction = RecoveryAction.RECONCILE_REMOTE_STATE;
        }

        candidates.push({
          caseId: c.id,
          status: c.status as unknown as BookingCaseStatus,
          ageMs,
          automationSessionId: latestSession?.id,
          suggestedAction,
          reason: `Case stuck in ${c.status} for ${Math.round(ageMs / 1000)}s exceeding threshold (${Math.round(threshold / 1000)}s)`,
        });
      }
    }

    return candidates;
  }
}

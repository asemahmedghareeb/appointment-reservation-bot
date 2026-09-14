import { Injectable } from '@nestjs/common';
import { prisma } from '@visaflow/database';
import { StuckCaseDetectorService } from './stuck-case-detector.service.js';
import type { RecoveryCandidate } from '@visaflow/shared-types';

@Injectable()
export class RecoveryService {
  constructor(private readonly stuckCaseDetector: StuckCaseDetectorService) {}

  async getRecoveryCandidates(): Promise<RecoveryCandidate[]> {
    return this.stuckCaseDetector.detectStuckCases();
  }

  async flagForAttention(candidate: RecoveryCandidate, reason?: string): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: 'system',
        bookingCaseId: candidate.caseId,
        type: 'NEED_ATTENTION',
        title: 'Case Requires Attention',
        message:
          reason ||
          `Case stuck in status ${candidate.status} for ${Math.round(candidate.ageMs / 1000)}s. Manual inspection advised.`,
      },
    });
  }
}

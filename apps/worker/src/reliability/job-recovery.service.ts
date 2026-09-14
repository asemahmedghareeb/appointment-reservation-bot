import {
  BookingCaseStatus as DbStatus,
  StateActorType,
} from '@visaflow/database';
import {
  RecoveryAction,
  type RecoveryCandidate,
} from '@visaflow/shared-types';
import {
  VfsRemoteStateInspector,
  VfsRemoteState,
} from '@visaflow/vfs-adapter';
import type { WorkerRepository } from '../repositories/worker.repository.js';
import type { AutomationSessionService } from '../services/automation-session.service.js';
import type { Page } from 'playwright';

export interface ReconcileResult {
  reconciled: boolean;
  actionTaken: RecoveryAction;
  details: string;
}

export class JobRecoveryService {
  private readonly remoteInspector = new VfsRemoteStateInspector();

  constructor(
    private readonly repo: WorkerRepository,
    private readonly sessionService: AutomationSessionService,
    private readonly workerId: string,
  ) {}

  /**
   * Safe reconciliation using Playwright page if browser session is alive
   */
  async reconcileWithPage(
    candidate: RecoveryCandidate,
    page: Page,
  ): Promise<ReconcileResult> {
    const inspection = await this.remoteInspector.inspect(page);

    switch (inspection.state) {
      case VfsRemoteState.CONFIRMED: {
        // If provider confirms booking, transition to CONFIRMED
        if (
          candidate.status === DbStatus.PAYMENT_PROCESSING ||
          candidate.status === DbStatus.PAYMENT_REQUIRED
        ) {
          await this.repo.atomicConditionalTransition({
            caseId: candidate.caseId,
            fromStatus: candidate.status as any,
            toStatus: DbStatus.CONFIRMED,
            actorType: StateActorType.WORKER,
            actorId: this.workerId,
            reason: 'Reconciled: Provider remote state shows confirmed booking',
            metadata: {
              reconciledFrom: inspection.state,
              details: inspection.details,
            },
          });
          return {
            reconciled: true,
            actionTaken: RecoveryAction.RECONCILE_REMOTE_STATE,
            details: 'Successfully transitioned to CONFIRMED based on provider confirmation',
          };
        }
        break;
      }

      case VfsRemoteState.PAYMENT_REQUIRED: {
        if (candidate.status === DbStatus.APPOINTMENT_SELECTED) {
          await this.repo.atomicConditionalTransition({
            caseId: candidate.caseId,
            fromStatus: candidate.status as any,
            toStatus: DbStatus.PAYMENT_REQUIRED,
            actorType: StateActorType.WORKER,
            actorId: this.workerId,
            reason: 'Reconciled: Remote state advanced to payment required',
            metadata: { reconciledFrom: inspection.state },
          });
          return {
            reconciled: true,
            actionTaken: RecoveryAction.RECONCILE_REMOTE_STATE,
            details: 'Reconciled to PAYMENT_REQUIRED',
          };
        }
        break;
      }

      case VfsRemoteState.SESSION_EXPIRED: {
        if (candidate.automationSessionId) {
          await this.sessionService.recordFailure({
            sessionId: candidate.automationSessionId,
            errorMessage: 'Provider session expired during execution',
          });
        }
        await this.repo.createNotification({
          userId: 'system',
          bookingCaseId: candidate.caseId,
          type: 'NEED_ATTENTION',
          title: 'Provider Session Expired',
          message: 'Provider session expired. Re-authentication required.',
        });
        return {
          reconciled: true,
          actionTaken: RecoveryAction.EXPIRE_SESSION,
          details: 'Session expired remotely; marked for operator attention',
        };
      }

      case VfsRemoteState.UNKNOWN:
      default: {
        // If unknown, STOP and require operator review
        await this.repo.createNotification({
          userId: 'system',
          bookingCaseId: candidate.caseId,
          type: 'NEED_ATTENTION',
          title: 'Remote State Unknown - Manual Inspection Required',
          message:
            'Operation encountered uncertain remote state. Stopped to prevent duplicate booking.',
        });
        return {
          reconciled: false,
          actionTaken: RecoveryAction.MARK_NEEDS_ATTENTION,
          details: 'Remote state unknown; moved to Needs Attention without repeating action',
        };
      }
    }

    return {
      reconciled: false,
      actionTaken: RecoveryAction.MARK_NEEDS_ATTENTION,
      details: `Cannot automatically reconcile state ${candidate.status} with provider state ${inspection.state}`,
    };
  }

  /**
   * Reconcile candidate where browser session is not reachable or died
   */
  async reconcileOrphan(candidate: RecoveryCandidate): Promise<ReconcileResult> {
    // Read fresh state to verify candidate is still stale
    const freshCase = await this.repo.findCaseById(candidate.caseId);
    if (!freshCase || freshCase.status !== candidate.status) {
      return {
        reconciled: false,
        actionTaken: RecoveryAction.NO_ACTION,
        details: 'Candidate state has already changed or case was deleted',
      };
    }

    // Handle stuck states safely
    if (
      candidate.status === DbStatus.AUTHENTICATING ||
      candidate.status === DbStatus.BOOKING
    ) {
      // Revert to READY or mark attention
      await this.repo.createNotification({
        userId: 'system',
        bookingCaseId: candidate.caseId,
        type: 'NEED_ATTENTION',
        title: 'Case Automation Stuck',
        message: `Case stuck in ${candidate.status} for ${Math.round(candidate.ageMs / 1000)}s. Requires review.`,
      });

      return {
        reconciled: true,
        actionTaken: RecoveryAction.MARK_NEEDS_ATTENTION,
        details: `Flagged stuck case in ${candidate.status} for attention`,
      };
    }

    return {
      reconciled: false,
      actionTaken: RecoveryAction.NO_ACTION,
      details: 'No reconciliation rule matched',
    };
  }
}

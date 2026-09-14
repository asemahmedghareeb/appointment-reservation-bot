import type { BookingCaseStatus } from '../enums/booking-case-status.enum.js';

export enum RecoveryAction {
  INSPECT_SESSION = 'INSPECT_SESSION',
  REQUEUE_SAFE_OPERATION = 'REQUEUE_SAFE_OPERATION',
  RECONCILE_REMOTE_STATE = 'RECONCILE_REMOTE_STATE',
  MARK_NEEDS_ATTENTION = 'MARK_NEEDS_ATTENTION',
  EXPIRE_SESSION = 'EXPIRE_SESSION',
  NO_ACTION = 'NO_ACTION',
}

export interface RecoveryCandidate {
  caseId: string;
  status: BookingCaseStatus;
  ageMs: number;
  automationSessionId?: string | undefined;
  suggestedAction: RecoveryAction;
  reason: string;
}

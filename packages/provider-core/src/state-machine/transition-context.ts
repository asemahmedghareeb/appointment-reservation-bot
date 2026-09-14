import type { BookingCaseStatus } from '@visaflow/shared-types';
import type { HumanActionType } from '../types/human-action-type.js';

export interface HumanVerificationMetadata {
  resumeToStatus: BookingCaseStatus;
  humanActionType: HumanActionType;
  checkpoint?: Record<string, unknown>;
}

export interface TransitionContext {
  fromStatus: BookingCaseStatus;
  toStatus: BookingCaseStatus;
  humanVerification?: HumanVerificationMetadata;
  reason?: string;
  metadata?: Record<string, unknown>;
}

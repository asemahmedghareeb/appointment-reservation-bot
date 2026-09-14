import type { BookingCaseStatus } from '@visaflow/shared-types';
import type { HumanActionType } from '@visaflow/provider-core';

export interface SessionResumeJobPayload {
  resumeToStatus: BookingCaseStatus;
  actionType: HumanActionType;
  checkpoint?: Record<string, unknown>;
}

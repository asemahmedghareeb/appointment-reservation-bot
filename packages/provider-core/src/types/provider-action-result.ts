import type { BookingCaseStatus } from '@visaflow/shared-types';
import type { HumanActionType } from './human-action-type.js';

export type ProviderActionResult<T> =
  | {
      kind: 'SUCCESS';
      data: T;
    }
  | {
      kind: 'HUMAN_ACTION_REQUIRED';
      action: HumanActionType;
      resumeToStatus: BookingCaseStatus;
      safeMessage?: string;
      checkpoint?: Record<string, unknown>;
    }
  | {
      kind: 'RETRYABLE_FAILURE';
      code: string;
      safeMessage: string;
    }
  | {
      kind: 'PERMANENT_FAILURE';
      code: string;
      safeMessage: string;
    };

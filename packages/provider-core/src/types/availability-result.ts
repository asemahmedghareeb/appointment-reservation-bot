import type { ProviderActionResult } from './provider-action-result.js';
import type { SlotCandidate } from './slot-candidate.js';

export type AvailabilityData =
  | {
      outcome: 'NO_SLOT';
    }
  | {
      outcome: 'SLOT_FOUND';
      slot: SlotCandidate;
    }
  | {
      outcome: 'GROUP_CAPACITY_MISMATCH';
      requestedApplicants: number;
      maximumAvailableApplicants: number;
    };

export type AvailabilityResult = ProviderActionResult<AvailabilityData>;

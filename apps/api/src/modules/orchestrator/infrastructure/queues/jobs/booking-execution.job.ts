import type { SlotCandidate } from '@visaflow/provider-core';

export interface BookingExecutionJobPayload {
  slot: SlotCandidate;
  allowGroupSplit: boolean;
}

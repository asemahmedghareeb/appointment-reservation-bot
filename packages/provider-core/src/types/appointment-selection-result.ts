import type { ProviderActionResult } from './provider-action-result.js';
import type { SlotCandidate } from './slot-candidate.js';

export interface AppointmentSelectionData {
  selectedSlot: SlotCandidate;
  selectedAt: string;
}

export type AppointmentSelectionResult = ProviderActionResult<AppointmentSelectionData>;

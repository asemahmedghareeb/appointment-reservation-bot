import type { ProviderActionResult } from './provider-action-result.js';

export interface ConfirmationData {
  referenceNumber: string;
  confirmedAt: string;
  appointmentDate: string;
  appointmentTime?: string;
  centre?: string;
  documentUrls?: string[];
}

export type ConfirmationResult = ProviderActionResult<ConfirmationData>;

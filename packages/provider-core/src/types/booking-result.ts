import type { ProviderActionResult } from './provider-action-result.js';

export type BookingData =
  | {
      outcome: 'STARTED';
      bookingSessionId?: string;
    }
  | {
      outcome: 'SLOT_LOST';
      reason?: string;
    };

export type BookingResult = ProviderActionResult<BookingData>;

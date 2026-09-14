import type { ProviderActionResult } from './provider-action-result.js';

export type PaymentState =
  | 'NOT_REQUIRED'
  | 'REQUIRED'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED';

export interface PaymentStateData {
  paymentState: PaymentState;
  amount?: number;
  currency?: string;
  paymentUrl?: string;
  reference?: string;
}

export type PaymentStateResult = ProviderActionResult<PaymentStateData>;

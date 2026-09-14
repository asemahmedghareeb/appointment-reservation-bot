import type { BookingMode } from '@visaflow/shared-types';
import type { ProviderActionResult } from './provider-action-result.js';

export interface RouteInspectionData {
  routeSupported: boolean;
  bookingMode: BookingMode;
  metadata?: Record<string, unknown>;
}

export type RouteInspectionResult = ProviderActionResult<RouteInspectionData>;

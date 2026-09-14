import type { ProviderCode } from '../enums/provider-code.enum.js';

export enum ProviderHealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN',
}

export interface ProviderHealthReport {
  provider: ProviderCode;
  status: ProviderHealthStatus;
  lastSuccessfulOperationAt?: string | null | undefined;
  recentFailureRate: number;
  activeSessions: number;
  pageChangedErrorsRecent: number;
  consecutiveFailures?: number | undefined;
  reason?: string | undefined;
}

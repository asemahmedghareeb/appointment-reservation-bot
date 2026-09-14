import type { ProviderActionResult } from './provider-action-result.js';

export interface AuthenticateData {
  sessionId?: string;
  authenticatedAt: string;
}

export type AuthenticateResult = ProviderActionResult<AuthenticateData>;

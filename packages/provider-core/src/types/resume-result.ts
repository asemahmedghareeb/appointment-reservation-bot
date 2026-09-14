import type { ProviderActionResult } from './provider-action-result.js';

export interface ResumeData {
  resumed: boolean;
  resumedAt: string;
}

export type ResumeResult = ProviderActionResult<ResumeData>;

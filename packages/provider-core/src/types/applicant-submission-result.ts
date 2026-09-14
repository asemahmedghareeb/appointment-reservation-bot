import type { ProviderActionResult } from './provider-action-result.js';

export interface ApplicantSubmissionData {
  submittedCount: number;
  providerApplicantIds?: Record<string, string>;
}

export type ApplicantSubmissionResult = ProviderActionResult<ApplicantSubmissionData>;

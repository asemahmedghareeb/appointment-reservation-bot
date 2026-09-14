import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';
import type { BookingCaseStatus } from '@visaflow/shared-types';

export class HumanResumeTargetMismatchError extends DomainError {
  constructor(
    public readonly caseId: string,
    public readonly expectedResumeStatus: BookingCaseStatus,
    public readonly requestedResumeStatus: BookingCaseStatus,
  ) {
    super(
      DomainErrorCode.DOMAIN_CONFLICT,
      `Cannot resume case '${caseId}' to status '${requestedResumeStatus}'. Persisted checkpoint requires resuming strictly to '${expectedResumeStatus}'.`,
      400,
      { caseId, expectedResumeStatus, requestedResumeStatus },
    );
    this.name = 'HumanResumeTargetMismatchError';
  }
}

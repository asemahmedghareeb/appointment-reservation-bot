import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class InvalidPrimaryApplicantError extends DomainError {
  constructor(caseId: string, reason: string) {
    super(
      DomainErrorCode.INVALID_PRIMARY_APPLICANT,
      `Invalid primary applicant for case '${caseId}': ${reason}`,
      400,
      { caseId, reason },
    );
    this.name = 'InvalidPrimaryApplicantError';
  }
}

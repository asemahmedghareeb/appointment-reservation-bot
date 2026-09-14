import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class InvalidApplicantPositionError extends DomainError {
  constructor(caseId: string, reason: string) {
    super(
      DomainErrorCode.INVALID_APPLICANT_POSITION,
      `Invalid applicant position for case '${caseId}': ${reason}`,
      400,
      { caseId, reason },
    );
    this.name = 'InvalidApplicantPositionError';
  }
}

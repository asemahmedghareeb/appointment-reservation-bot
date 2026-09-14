import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ApplicantNotFoundError extends DomainError {
  constructor(applicantId: string) {
    super(
      DomainErrorCode.APPLICANT_NOT_FOUND,
      `Applicant with ID '${applicantId}' was not found.`,
      404,
      { applicantId },
    );
    this.name = 'ApplicantNotFoundError';
  }
}

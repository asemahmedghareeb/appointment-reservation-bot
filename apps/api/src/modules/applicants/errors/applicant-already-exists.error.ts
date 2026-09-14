import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ApplicantAlreadyExistsError extends DomainError {
  constructor(existingApplicantId: string) {
    super(
      DomainErrorCode.APPLICANT_ALREADY_EXISTS,
      'An applicant with this passport already exists.',
      409,
      { existingApplicantId },
    );
    this.name = 'ApplicantAlreadyExistsError';
  }
}

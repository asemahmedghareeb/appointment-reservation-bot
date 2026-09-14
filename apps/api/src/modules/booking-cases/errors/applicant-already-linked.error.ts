import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ApplicantAlreadyLinkedError extends DomainError {
  constructor(caseId: string, applicantId: string) {
    super(
      DomainErrorCode.APPLICANT_ALREADY_LINKED,
      `Applicant '${applicantId}' is already linked to booking case '${caseId}'.`,
      409,
      { caseId, applicantId },
    );
    this.name = 'ApplicantAlreadyLinkedError';
  }
}

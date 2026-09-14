import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ApplicantLinkedToCasesError extends DomainError {
  constructor(applicantId: string, linkedCaseCount: number) {
    super(
      DomainErrorCode.APPLICANT_LINKED_TO_CASES,
      `Cannot delete applicant '${applicantId}' because they are linked to ${linkedCaseCount} booking case(s).`,
      409,
      { applicantId, linkedCaseCount },
    );
    this.name = 'ApplicantLinkedToCasesError';
  }
}

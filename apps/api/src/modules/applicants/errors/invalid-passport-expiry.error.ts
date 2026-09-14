import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class InvalidPassportExpiryError extends DomainError {
  constructor(applicantId: string, rule: string, reason?: string) {
    super(
      DomainErrorCode.INVALID_PASSPORT_EXPIRY,
      reason || "Applicant passport does not satisfy this provider route's validity rules.",
      400,
      { applicantId, rule },
    );
    this.name = 'InvalidPassportExpiryError';
  }
}

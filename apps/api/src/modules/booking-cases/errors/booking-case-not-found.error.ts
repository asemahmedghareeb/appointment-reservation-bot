import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class BookingCaseNotFoundError extends DomainError {
  constructor(caseId: string) {
    super(
      DomainErrorCode.BOOKING_CASE_NOT_FOUND,
      `Booking case with ID '${caseId}' was not found.`,
      404,
      { caseId },
    );
    this.name = 'BookingCaseNotFoundError';
  }
}

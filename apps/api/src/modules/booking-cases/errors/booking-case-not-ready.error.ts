import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class BookingCaseNotReadyError extends DomainError {
  constructor(caseId: string, rule: string, reason: string) {
    super(
      DomainErrorCode.BOOKING_CASE_NOT_READY,
      `Booking case '${caseId}' is not ready: ${reason}`,
      400,
      { caseId, rule, reason },
    );
    this.name = 'BookingCaseNotReadyError';
  }
}

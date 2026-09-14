import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';
import type { BookingCaseStatus } from '@visaflow/shared-types';

export class BookingCaseNotDraftError extends DomainError {
  constructor(caseId: string, currentStatus: BookingCaseStatus | string) {
    super(
      DomainErrorCode.BOOKING_CASE_NOT_DRAFT,
      `Booking case '${caseId}' cannot be modified because its current status is '${currentStatus}' (only DRAFT cases can be modified).`,
      400,
      { caseId, currentStatus },
    );
    this.name = 'BookingCaseNotDraftError';
  }
}

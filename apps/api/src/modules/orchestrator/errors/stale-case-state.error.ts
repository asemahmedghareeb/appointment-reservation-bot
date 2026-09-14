import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';
import type { BookingCaseStatus } from '@visaflow/shared-types';

export class StaleCaseStateError extends DomainError {
  constructor(
    public readonly caseId: string,
    public readonly expectedStatus: BookingCaseStatus | string,
    public readonly actualStatus?: BookingCaseStatus | string,
  ) {
    super(
      DomainErrorCode.DOMAIN_CONFLICT,
      `Case '${caseId}' state is stale. Expected '${expectedStatus}' but database row was modified concurrently${
        actualStatus ? ` (current status: '${actualStatus}')` : ''
      }.`,
      409,
      { caseId, expectedStatus, actualStatus },
    );
    this.name = 'StaleCaseStateError';
  }
}

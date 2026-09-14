import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ProviderAccountRequiredError extends DomainError {
  constructor(caseId: string) {
    super(
      DomainErrorCode.PROVIDER_ACCOUNT_REQUIRED,
      `Case ${caseId} does not have an active provider account assigned for automated execution.`,
      400,
      { caseId },
    );
    this.name = 'ProviderAccountRequiredError';
  }
}

export class ProviderAccountMismatchError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      DomainErrorCode.PROVIDER_ACCOUNT_MISMATCH,
      message,
      400,
      details,
    );
    this.name = 'ProviderAccountMismatchError';
  }
}

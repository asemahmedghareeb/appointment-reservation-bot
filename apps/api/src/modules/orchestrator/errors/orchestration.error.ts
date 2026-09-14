import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class OrchestrationInvariantError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      DomainErrorCode.ORCHESTRATION_INVARIANT_VIOLATION,
      message,
      500,
      details,
    );
    this.name = 'OrchestrationInvariantError';
  }
}

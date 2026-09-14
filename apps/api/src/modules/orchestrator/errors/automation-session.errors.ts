import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class AutomationSessionNotFoundError extends DomainError {
  constructor(caseId: string) {
    super(
      DomainErrorCode.AUTOMATION_SESSION_NOT_FOUND,
      `No active automation session found for case ${caseId}.`,
      404,
      { caseId },
    );
    this.name = 'AutomationSessionNotFoundError';
  }
}

export class AutomationSessionOwnerMismatchError extends DomainError {
  constructor(caseId: string, details?: Record<string, unknown>) {
    super(
      DomainErrorCode.AUTOMATION_SESSION_OWNER_MISMATCH,
      `Automation session for case ${caseId} is owned by another worker process and cannot be claimed directly.`,
      409,
      details,
    );
    this.name = 'AutomationSessionOwnerMismatchError';
  }
}

export class AutomationSessionConflictError extends DomainError {
  constructor(caseId: string, details?: Record<string, unknown>) {
    super(
      DomainErrorCode.AUTOMATION_SESSION_CONFLICT,
      `Case ${caseId} already has an active automation session in progress.`,
      409,
      details,
    );
    this.name = 'AutomationSessionConflictError';
  }
}

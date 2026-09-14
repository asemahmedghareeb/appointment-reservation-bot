import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ClientHasDependentsError extends DomainError {
  constructor(clientId: string, dependentCount: number) {
    super(
      DomainErrorCode.CLIENT_HAS_DEPENDENTS,
      `Cannot delete client '${clientId}' because they are linked to ${dependentCount} applicant(s).`,
      409,
      { clientId, dependentCount },
    );
    this.name = 'ClientHasDependentsError';
  }
}

import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ClientNotFoundError extends DomainError {
  constructor(clientId: string) {
    super(
      DomainErrorCode.CLIENT_NOT_FOUND,
      `Client with ID '${clientId}' was not found.`,
      404,
      { clientId },
    );
    this.name = 'ClientNotFoundError';
  }
}

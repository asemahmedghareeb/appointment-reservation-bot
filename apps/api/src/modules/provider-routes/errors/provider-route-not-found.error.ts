import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ProviderRouteNotFoundError extends DomainError {
  constructor(providerRouteId: string) {
    super(
      DomainErrorCode.PROVIDER_ROUTE_NOT_FOUND,
      `Provider route with ID '${providerRouteId}' was not found.`,
      404,
      { providerRouteId },
    );
    this.name = 'ProviderRouteNotFoundError';
  }
}

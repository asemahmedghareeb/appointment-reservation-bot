import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';

export class ProviderRouteDisabledError extends DomainError {
  constructor(providerRouteId: string) {
    super(
      DomainErrorCode.PROVIDER_ROUTE_DISABLED,
      `Provider route with ID '${providerRouteId}' is disabled and cannot be used for booking cases.`,
      400,
      { providerRouteId },
    );
    this.name = 'ProviderRouteDisabledError';
  }
}

import { DomainError } from '../../../common/errors/domain-error.js';
import { DomainErrorCode } from '../../../common/errors/domain-error-codes.js';
import type { ProviderCode } from '@visaflow/shared-types';

export class ProviderAdapterUnavailableError extends DomainError {
  constructor(public readonly providerCode: ProviderCode, message?: string) {
    super(
      DomainErrorCode.PROVIDER_ADAPTER_UNAVAILABLE,
      message ??
        `No provider adapter is registered or available for provider code '${providerCode}'.`,
      503,
      { providerCode },
    );
    this.name = 'ProviderAdapterUnavailableError';
  }
}

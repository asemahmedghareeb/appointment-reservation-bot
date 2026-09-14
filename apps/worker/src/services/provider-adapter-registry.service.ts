import { ProviderCode } from '@visaflow/shared-types';
import type { VisaProviderAdapter } from '@visaflow/provider-core';

export class ProviderAdapterRegistryService {
  private readonly adapters = new Map<ProviderCode, VisaProviderAdapter>();

  register(providerCode: ProviderCode, adapter: VisaProviderAdapter): void {
    this.adapters.set(providerCode, adapter);
  }

  resolve(providerCode: ProviderCode): VisaProviderAdapter {
    const adapter = this.adapters.get(providerCode);
    if (!adapter) {
      throw new Error(`Provider adapter unavailable for provider: ${providerCode}`);
    }
    return adapter;
  }
}

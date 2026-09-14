import { Injectable } from '@nestjs/common';
import type { ProviderCode } from '@visaflow/shared-types';
import type { VisaProviderAdapter } from '@visaflow/provider-core';
import { ProviderAdapterUnavailableError } from '../errors/provider-adapter-unavailable.error.js';

@Injectable()
export class ProviderAdapterResolver {
  private readonly adapters = new Map<ProviderCode, VisaProviderAdapter>();
  private defaultFallbackAdapter?: VisaProviderAdapter;

  registerAdapter(providerCode: ProviderCode, adapter: VisaProviderAdapter): void {
    this.adapters.set(providerCode, adapter);
  }

  setDefaultFallbackAdapter(adapter: VisaProviderAdapter): void {
    this.defaultFallbackAdapter = adapter;
  }

  resolve(providerCode: ProviderCode): VisaProviderAdapter {
    const adapter = this.adapters.get(providerCode);
    if (adapter) {
      return adapter;
    }

    if (this.defaultFallbackAdapter) {
      return this.defaultFallbackAdapter;
    }

    throw new ProviderAdapterUnavailableError(providerCode);
  }
}

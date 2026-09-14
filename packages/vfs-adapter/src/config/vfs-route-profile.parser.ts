import type { VfsRouteProfile } from './vfs-route-profile.js';
import { VfsRouteNotSupportedError } from '../errors/vfs-route-not-supported.error.js';

export function parseVfsRouteProfile(config: Record<string, unknown> | null | undefined): VfsRouteProfile {
  if (!config || typeof config !== 'object') {
    throw new VfsRouteNotSupportedError('Route configuration is missing or empty.');
  }

  const adapterProfile = typeof config.adapterProfile === 'string' ? config.adapterProfile : 'vfs-standard';
  const entryUrl = typeof config.entryUrl === 'string' ? config.entryUrl : '';
  const availabilityMode = config.availabilityMode === 'CALENDAR' ? 'CALENDAR' : 'EARLIEST_SLOT';
  const expectedProviderCode = config.expectedProviderCode === 'VFS' ? 'VFS' : 'VFS';

  let capabilities: VfsRouteProfile['capabilities'];
  if (config.capabilities && typeof config.capabilities === 'object') {
    const caps = config.capabilities as Record<string, unknown>;
    capabilities = {
      groupBooking: typeof caps.groupBooking === 'boolean' ? caps.groupBooking : true,
      applicantLimit: typeof caps.applicantLimit === 'number' ? caps.applicantLimit : 5,
    };
  }

  return {
    adapterProfile,
    entryUrl,
    availabilityMode,
    expectedProviderCode,
    capabilities,
  };
}

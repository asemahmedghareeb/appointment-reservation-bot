import type { VfsRouteProfile } from './vfs-route-profile.js';
import { VfsRouteNotSupportedError } from '../errors/vfs-route-not-supported.error.js';

export interface VfsRouteContextFallback {
  sourceCountry?: string;
  destinationCountry?: string;
}

export function parseVfsRouteProfile(
  config: Record<string, unknown> | null | undefined,
  fallbackContext?: VfsRouteContextFallback,
): VfsRouteProfile {
  if (!config || typeof config !== 'object') {
    throw new VfsRouteNotSupportedError('Route configuration is missing or empty.');
  }

  const adapterProfile = typeof config.adapterProfile === 'string' ? config.adapterProfile : 'vfs-standard';

  const sourceCountry =
    typeof config.sourceCountry === 'string' && config.sourceCountry.trim() !== ''
      ? config.sourceCountry.trim()
      : fallbackContext?.sourceCountry?.trim() || 'EG';

  const destinationCountry =
    typeof config.destinationCountry === 'string' && config.destinationCountry.trim() !== ''
      ? config.destinationCountry.trim()
      : fallbackContext?.destinationCountry?.trim() || '';

  if (!destinationCountry) {
    throw new VfsRouteNotSupportedError('Route configuration destinationCountry is missing.');
  }

  const entryUrl = typeof config.entryUrl === 'string' ? config.entryUrl.trim() : '';
  if (!entryUrl) {
    throw new VfsRouteNotSupportedError('Route configuration entryUrl is missing.');
  }

  const availabilityMode: 'CALENDAR' | 'EARLIEST_SLOT' =
    config.availabilityMode === 'CALENDAR' ? 'CALENDAR' : 'EARLIEST_SLOT';

  const pageProfile =
    typeof config.pageProfile === 'string' && config.pageProfile.trim() !== ''
      ? config.pageProfile.trim()
      : availabilityMode === 'CALENDAR'
        ? 'VFS_CALENDAR_V1'
        : 'VFS_STANDARD_V1';

  let capabilities: VfsRouteProfile['capabilities'];
  if (config.capabilities && typeof config.capabilities === 'object') {
    const caps = config.capabilities as Record<string, unknown>;
    capabilities = {
      groupBooking: typeof caps.groupBooking === 'boolean' ? caps.groupBooking : true,
      applicantLimit: typeof caps.applicantLimit === 'number' ? caps.applicantLimit : 5,
      paymentRequired: typeof caps.paymentRequired === 'boolean' ? caps.paymentRequired : false,
    };
  } else {
    capabilities = {
      groupBooking: true,
      applicantLimit: 5,
      paymentRequired: false,
    };
  }

  const metadata =
    config.metadata && typeof config.metadata === 'object'
      ? (config.metadata as Record<string, unknown>)
      : undefined;

  return {
    adapterProfile,
    sourceCountry,
    destinationCountry,
    entryUrl,
    availabilityMode,
    pageProfile,
    capabilities,
    ...(metadata ? { metadata } : {}),
  };
}

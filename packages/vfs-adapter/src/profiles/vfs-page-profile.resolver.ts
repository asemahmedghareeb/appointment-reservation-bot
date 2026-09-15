import {
  VFS_PAGE_PROFILES,
  KNOWN_VFS_PAGE_PROFILES,
  type VfsPageProfileDefinition,
} from './vfs-page-profile.js';
import type { VfsRouteProfile } from '../config/vfs-route-profile.js';

export class VfsPageProfileResolver {
  resolve(routeProfile: VfsRouteProfile): VfsPageProfileDefinition {
    const requestedProfile = routeProfile.pageProfile?.trim();

    if (requestedProfile && KNOWN_VFS_PAGE_PROFILES[requestedProfile]) {
      return KNOWN_VFS_PAGE_PROFILES[requestedProfile]!;
    }

    // Default by availabilityMode
    if (routeProfile.availabilityMode === 'CALENDAR') {
      return KNOWN_VFS_PAGE_PROFILES[VFS_PAGE_PROFILES.CALENDAR_V1]!;
    }

    return KNOWN_VFS_PAGE_PROFILES[VFS_PAGE_PROFILES.STANDARD_V1]!;
  }
}

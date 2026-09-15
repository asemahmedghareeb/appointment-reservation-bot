import type { VfsRouteProfile } from '../config/vfs-route-profile.js';
import { VfsPageProfileResolver } from '../profiles/vfs-page-profile.resolver.js';

export interface VfsCapabilities {
  availabilityMode: 'CALENDAR' | 'EARLIEST_SLOT';
  supportsGroupBooking: boolean;
  maxApplicants?: number;
  requiresPayment?: boolean;
  pageProfile: string;
}

export class VfsCapabilityResolver {
  private readonly pageProfileResolver = new VfsPageProfileResolver();

  resolve(routeProfile: VfsRouteProfile): VfsCapabilities {
    const pageDef = this.pageProfileResolver.resolve(routeProfile);

    const supportsGroupBooking = routeProfile.capabilities?.groupBooking ?? true;
    const maxApplicants = routeProfile.capabilities?.applicantLimit ?? 5;
    const requiresPayment = routeProfile.capabilities?.paymentRequired ?? false;

    return {
      availabilityMode: routeProfile.availabilityMode,
      supportsGroupBooking,
      maxApplicants,
      requiresPayment,
      pageProfile: pageDef.profileId,
    };
  }
}

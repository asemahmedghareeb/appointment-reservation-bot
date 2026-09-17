export interface VfsRouteProfile {
  adapterProfile: string;

  sourceCountry: string;
  destinationCountry: string;

  entryUrl: string;

  availabilityMode: 'CALENDAR' | 'EARLIEST_SLOT';

  pageProfile: string;

  capabilities?: {
    groupBooking?: boolean;
    applicantLimit?: number;
    paymentRequired?: boolean;
  };

  metadata?: Record<string, unknown>;
}

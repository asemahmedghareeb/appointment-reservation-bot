export interface VfsRouteProfile {
  adapterProfile: string;
  entryUrl: string;
  availabilityMode: 'EARLIEST_SLOT' | 'CALENDAR';
  expectedProviderCode: 'VFS';
  capabilities?: {
    groupBooking?: boolean;
    applicantLimit?: number;
  };
}

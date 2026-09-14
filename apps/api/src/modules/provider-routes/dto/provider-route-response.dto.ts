import type { ProviderCode, BookingMode, ProviderRouteConfig } from '@visaflow/shared-types';

export class ProviderRouteResponseDto {
  id!: string;
  providerId!: string;
  providerCode!: ProviderCode;
  providerName!: string;
  sourceCountry!: string;
  destinationCountry!: string;
  applicationCentre!: string;
  visaCategory!: string;
  visaSubcategory!: string;
  bookingMode!: BookingMode;
  enabled!: boolean;
  configurationJson!: ProviderRouteConfig | null;
  createdAt!: Date;
  updatedAt!: Date;
}

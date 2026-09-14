import type { BookingMode, ProviderCode } from '@visaflow/shared-types';

export interface ProviderContext {
  caseId: string;
  correlationId: string;
  providerRoute: {
    id: string;
    providerCode: ProviderCode;
    sourceCountry: string;
    destinationCountry: string;
    applicationCentre: string;
    visaCategory: string;
    visaSubcategory: string;
    bookingMode: BookingMode;
    configuration: Record<string, unknown>;
  };
  casePreferences: {
    preferredDateFrom?: string;
    preferredDateTo?: string;
    preferredTime?: string;
    allowGroupSplit: boolean;
  };
  applicantCount: number;
  providerAccountId?: string | undefined;
}

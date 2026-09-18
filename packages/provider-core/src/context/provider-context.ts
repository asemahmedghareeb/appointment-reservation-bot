import type { BookingMode, ProviderCode } from '@visaflow/shared-types';
import type { ProviderApplicantInput } from '../types/provider-applicant-input.js';

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
    appointmentSelectionMode?: string;
    preferredDateFrom?: string;
    preferredDateTo?: string;
    preferredDate?: string;
    preferredTime?: string;
    preferredTimeFrom?: string;
    preferredTimeTo?: string;
    acceptAnyAvailableTime?: boolean;
    appointmentType?: string;
    services?: Array<{ providerServiceCode?: string; name: string; selected: boolean }>;
    allowGroupSplit: boolean;
  };
  applicantCount: number;
  providerAccountId?: string | undefined;
  applicants?: ProviderApplicantInput[] | undefined;
}

import type {
  BookingCaseStatus,
  BookingMode,
  AppointmentSelectionMode,
  ApplicantRelation,
  Gender,
  ProviderCode,
} from '@visaflow/shared-types';

export class BookingApplicantDetailDto {
  id!: string;
  applicantId!: string;
  firstName!: string;
  lastName!: string;
  gender!: Gender;
  dateOfBirth!: Date;
  nationality!: string;
  passportMasked!: string;
  passportExpiry!: Date;
  phone?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  position!: number;
  relation!: ApplicantRelation;
  isPrimary!: boolean;
}

export class BookingCaseResponseDto {
  id!: string;
  caseNumber!: string;
  status!: BookingCaseStatus;
  bookingMode!: BookingMode;
  appointmentSelectionMode!: AppointmentSelectionMode;
  preferredDateFrom!: Date | null;
  preferredDateTo!: Date | null;
  preferredDate!: Date | null;
  preferredTime!: string | null;
  preferredTimeFrom!: string | null;
  preferredTimeTo!: string | null;
  acceptAnyAvailableTime!: boolean;
  appointmentType!: string | null;
  servicesJson!: any;
  providerTermsAccepted!: boolean;
  termsAcceptedAt!: Date | null;
  marketingConsent!: boolean;
  marketingConsentAt!: Date | null;
  providerServiceFee!: number | null;
  optionalServicesTotal!: number | null;
  additionalFees!: number | null;
  totalAmount!: number | null;
  currency!: string | null;
  feeCapturedAt!: Date | null;
  allowGroupSplit!: boolean;
  createdById!: string;
  createdAt!: Date;
  updatedAt!: Date;

  providerRoute!: {
    id: string;
    providerCode: ProviderCode;
    providerName: string;
    sourceCountry: string;
    destinationCountry: string;
    applicationCentre: string;
    visaCategory: string;
    visaSubcategory: string;
  };

  applicants!: BookingApplicantDetailDto[];
  applicantCount!: number;
  primaryApplicantId!: string | null;
}

import type {
  BookingCaseStatus,
  BookingMode,
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
  position!: number;
  relation!: ApplicantRelation;
  isPrimary!: boolean;
}

export class BookingCaseResponseDto {
  id!: string;
  caseNumber!: string;
  status!: BookingCaseStatus;
  bookingMode!: BookingMode;
  preferredDateFrom!: Date | null;
  preferredDateTo!: Date | null;
  preferredTime!: string | null;
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

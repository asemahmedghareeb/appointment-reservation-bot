import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsBoolean, IsEnum } from 'class-validator';
import { AppointmentSelectionMode } from '@visaflow/shared-types';

export class CreateBookingCaseDto {
  @IsString()
  @IsNotEmpty()
  providerRouteId!: string;

  @IsOptional()
  @IsEnum(AppointmentSelectionMode)
  appointmentSelectionMode?: AppointmentSelectionMode = AppointmentSelectionMode.ANY_AVAILABLE;

  @IsOptional()
  @IsISO8601()
  preferredDateFrom?: string;

  @IsOptional()
  @IsISO8601()
  preferredDateTo?: string;

  @IsOptional()
  @IsISO8601()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  preferredTime?: string;

  @IsOptional()
  @IsString()
  preferredTimeFrom?: string;

  @IsOptional()
  @IsString()
  preferredTimeTo?: string;

  @IsOptional()
  @IsBoolean()
  acceptAnyAvailableTime?: boolean = true;

  @IsOptional()
  @IsString()
  appointmentType?: string;

  @IsOptional()
  servicesJson?: any;

  @IsOptional()
  @IsBoolean()
  providerTermsAccepted?: boolean = false;

  @IsOptional()
  @IsISO8601()
  termsAcceptedAt?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean = false;

  @IsOptional()
  @IsISO8601()
  marketingConsentAt?: string;

  @IsOptional()
  @IsBoolean()
  allowGroupSplit?: boolean = false;
}

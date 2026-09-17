import { IsString, IsOptional, IsISO8601, IsBoolean, IsEnum } from 'class-validator';
import { AppointmentSelectionMode } from '@visaflow/shared-types';

export class UpdateBookingCaseDto {
  @IsOptional()
  @IsString()
  providerRouteId?: string;

  @IsOptional()
  @IsEnum(AppointmentSelectionMode)
  appointmentSelectionMode?: AppointmentSelectionMode;

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
  acceptAnyAvailableTime?: boolean;

  @IsOptional()
  @IsString()
  appointmentType?: string;

  @IsOptional()
  servicesJson?: any;

  @IsOptional()
  @IsBoolean()
  providerTermsAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  allowGroupSplit?: boolean;
}

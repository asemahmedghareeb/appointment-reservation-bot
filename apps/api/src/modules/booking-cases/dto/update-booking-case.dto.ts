import { IsString, IsOptional, IsISO8601, IsBoolean } from 'class-validator';

export class UpdateBookingCaseDto {
  @IsOptional()
  @IsString()
  providerRouteId?: string;

  @IsOptional()
  @IsISO8601()
  preferredDateFrom?: string;

  @IsOptional()
  @IsISO8601()
  preferredDateTo?: string;

  @IsOptional()
  @IsString()
  preferredTime?: string;

  @IsOptional()
  @IsBoolean()
  allowGroupSplit?: boolean;
}

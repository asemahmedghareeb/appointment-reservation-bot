import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsBoolean } from 'class-validator';

export class CreateBookingCaseDto {
  @IsString()
  @IsNotEmpty()
  providerRouteId!: string;

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
  allowGroupSplit?: boolean = false;
}

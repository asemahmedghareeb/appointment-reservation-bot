import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ProviderCode, BookingMode } from '@visaflow/shared-types';

export class ProviderRouteQueryDto {
  @IsOptional()
  @IsEnum(ProviderCode)
  provider?: ProviderCode;

  @IsOptional()
  @IsString()
  sourceCountry?: string;

  @IsOptional()
  @IsString()
  destinationCountry?: string;

  @IsOptional()
  @IsString()
  applicationCentre?: string;

  @IsOptional()
  @IsString()
  visaCategory?: string;

  @IsOptional()
  @IsString()
  visaSubcategory?: string;

  @IsOptional()
  @IsEnum(BookingMode)
  bookingMode?: BookingMode;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean = true;
}

import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingCaseStatus, ProviderCode } from '@visaflow/shared-types';

export class ListBookingCasesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(BookingCaseStatus)
  status?: BookingCaseStatus;

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
  createdBy?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

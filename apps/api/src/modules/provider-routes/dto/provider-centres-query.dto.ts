import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ProviderCode } from '@visaflow/shared-types';

export class ProviderCentresQueryDto {
  @IsOptional()
  @IsEnum(ProviderCode)
  provider?: ProviderCode;

  @IsOptional()
  @IsString()
  sourceCountry?: string;

  @IsOptional()
  @IsString()
  destinationCountry?: string;
}

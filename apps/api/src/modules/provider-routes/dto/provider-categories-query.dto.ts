import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ProviderCode } from '@visaflow/shared-types';

export class ProviderCategoriesQueryDto {
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
}

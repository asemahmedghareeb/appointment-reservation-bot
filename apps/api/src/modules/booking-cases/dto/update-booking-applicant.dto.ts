import { IsEnum, IsBoolean, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicantRelation } from '@visaflow/shared-types';

export class UpdateBookingApplicantDto {
  @IsOptional()
  @IsEnum(ApplicantRelation)
  relation?: ApplicantRelation;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position?: number;
}

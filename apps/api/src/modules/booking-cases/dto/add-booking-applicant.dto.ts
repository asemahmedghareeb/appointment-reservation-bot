import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicantRelation } from '@visaflow/shared-types';

export class AddBookingApplicantDto {
  @IsString()
  @IsNotEmpty()
  applicantId!: string;

  @IsEnum(ApplicantRelation)
  relation!: ApplicantRelation;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position?: number;
}

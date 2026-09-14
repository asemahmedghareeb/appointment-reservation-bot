import {
  IsString,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { Gender } from '@visaflow/shared-types';

export class UpdateApplicantDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsISO8601()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  passportNumber?: string;

  @IsISO8601()
  @IsOptional()
  passportExpiry?: string;

  @IsString()
  @IsOptional()
  clientId?: string;
}

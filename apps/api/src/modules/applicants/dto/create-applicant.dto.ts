import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { Gender } from '@visaflow/shared-types';

export class CreateApplicantDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsISO8601()
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  nationality!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  passportNumber!: string;

  @IsISO8601()
  passportExpiry!: string;

  @IsString()
  @IsOptional()
  clientId?: string;
}

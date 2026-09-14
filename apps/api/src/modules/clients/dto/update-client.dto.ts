import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

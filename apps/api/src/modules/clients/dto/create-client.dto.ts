import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

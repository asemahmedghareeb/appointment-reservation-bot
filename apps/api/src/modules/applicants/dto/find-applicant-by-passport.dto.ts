import { IsString, IsNotEmpty } from 'class-validator';

export class FindApplicantByPassportDto {
  @IsString()
  @IsNotEmpty()
  passportNumber!: string;
}

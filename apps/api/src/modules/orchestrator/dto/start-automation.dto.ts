import { IsOptional, IsString } from 'class-validator';

export class StartAutomationDto {
  @IsOptional()
  @IsString()
  providerAccountId?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class ResumeAutomationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

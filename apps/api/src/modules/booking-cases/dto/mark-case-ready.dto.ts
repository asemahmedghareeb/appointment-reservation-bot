import { IsOptional, IsString } from 'class-validator';

export class MarkCaseReadyDto {
  @IsOptional()
  @IsString()
  reason?: string = 'All applicants validated and case ready for processing';
}

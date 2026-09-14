import { IsOptional, IsInt, Min, Max, IsBoolean, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean = false;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  bookingCaseId?: string;
}

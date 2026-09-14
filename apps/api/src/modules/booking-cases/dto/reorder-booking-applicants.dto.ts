import { IsArray, ValidateNested, IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @IsString()
  @IsNotEmpty()
  bookingApplicantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  position!: number;
}

export class ReorderBookingApplicantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

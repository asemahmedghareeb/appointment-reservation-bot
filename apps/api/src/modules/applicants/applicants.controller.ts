import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApplicantsService } from './applicants.service.js';
import { CreateApplicantDto } from './dto/create-applicant.dto.js';
import { UpdateApplicantDto } from './dto/update-applicant.dto.js';
import { ListApplicantsQueryDto } from './dto/list-applicants-query.dto.js';
import { FindApplicantByPassportDto } from './dto/find-applicant-by-passport.dto.js';
import type { ApplicantResponseDto } from './dto/applicant-response.dto.js';
import type { PaginatedResult } from '@visaflow/shared-types';

@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateApplicantDto): Promise<ApplicantResponseDto> {
    return this.applicantsService.create(dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<ApplicantResponseDto> {
    return this.applicantsService.findById(id);
  }

  @Post('lookup/passport')
  @HttpCode(HttpStatus.OK)
  async findByPassport(@Body() dto: FindApplicantByPassportDto): Promise<ApplicantResponseDto> {
    return this.applicantsService.findByPassport(dto);
  }

  @Get()
  async list(
    @Query() query: ListApplicantsQueryDto,
  ): Promise<PaginatedResult<ApplicantResponseDto>> {
    return this.applicantsService.list(query);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicantDto,
  ): Promise<ApplicantResponseDto> {
    return this.applicantsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.applicantsService.delete(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { BookingCasesService } from './booking-cases.service.js';
import { CreateBookingCaseDto } from './dto/create-booking-case.dto.js';
import { UpdateBookingCaseDto } from './dto/update-booking-case.dto.js';
import { ListBookingCasesQueryDto } from './dto/list-booking-cases-query.dto.js';
import { AddBookingApplicantDto } from './dto/add-booking-applicant.dto.js';
import { ReorderBookingApplicantsDto } from './dto/reorder-booking-applicants.dto.js';
import { MarkCaseReadyDto } from './dto/mark-case-ready.dto.js';
import type { BookingCaseResponseDto } from './dto/booking-case-response.dto.js';
import type { PaginatedResult } from '@visaflow/shared-types';

@Controller('booking-cases')
export class BookingCasesController {
  constructor(private readonly bookingCasesService: BookingCasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateBookingCaseDto,
    @Headers('x-user-id') userIdHeader?: string,
  ): Promise<BookingCaseResponseDto> {
    return this.bookingCasesService.create(dto, userIdHeader);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<BookingCaseResponseDto> {
    return this.bookingCasesService.findById(id);
  }

  @Get()
  async list(
    @Query() query: ListBookingCasesQueryDto,
  ): Promise<PaginatedResult<BookingCaseResponseDto>> {
    return this.bookingCasesService.list(query);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingCaseDto,
  ): Promise<BookingCaseResponseDto> {
    return this.bookingCasesService.update(id, dto);
  }

  @Post(':id/applicants')
  @HttpCode(HttpStatus.CREATED)
  async addApplicant(
    @Param('id') id: string,
    @Body() dto: AddBookingApplicantDto,
  ): Promise<BookingCaseResponseDto> {
    return this.bookingCasesService.addApplicant(id, dto);
  }

  @Put(':id/primary-applicant/:bookingApplicantId')
  async setPrimaryApplicant(
    @Param('id') id: string,
    @Param('bookingApplicantId') bookingApplicantId: string,
  ): Promise<BookingCaseResponseDto> {
    return this.bookingCasesService.setPrimaryApplicant(id, bookingApplicantId);
  }

  @Put(':id/applicants/reorder')
  async reorderApplicants(
    @Param('id') id: string,
    @Body() dto: ReorderBookingApplicantsDto,
  ): Promise<BookingCaseResponseDto> {
    return this.bookingCasesService.reorderApplicants(id, dto);
  }

  @Delete(':id/applicants/:bookingApplicantId')
  async removeApplicant(
    @Param('id') id: string,
    @Param('bookingApplicantId') bookingApplicantId: string,
  ): Promise<BookingCaseResponseDto> {
    return this.bookingCasesService.removeApplicant(id, bookingApplicantId);
  }

  @Post(':id/ready')
  @HttpCode(HttpStatus.OK)
  async markReady(
    @Param('id') id: string,
    @Body() dto?: MarkCaseReadyDto,
    @Headers('x-user-id') userIdHeader?: string,
  ): Promise<BookingCaseResponseDto> {
    return this.bookingCasesService.markReady(id, dto, userIdHeader);
  }
}

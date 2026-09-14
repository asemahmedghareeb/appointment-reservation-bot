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
  Headers,
} from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { ListClientsQueryDto } from './dto/list-clients-query.dto.js';
import type { ClientResponseDto } from './dto/client-response.dto.js';
import type { PaginatedResult } from '@visaflow/shared-types';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateClientDto,
    @Headers('x-user-id') userIdHeader?: string,
  ): Promise<ClientResponseDto> {
    return this.clientsService.create(dto, userIdHeader);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<ClientResponseDto> {
    return this.clientsService.findById(id);
  }

  @Get()
  async list(
    @Query() query: ListClientsQueryDto,
  ): Promise<PaginatedResult<ClientResponseDto>> {
    return this.clientsService.list(query);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.clientsService.delete(id);
  }
}

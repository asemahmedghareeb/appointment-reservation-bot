import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProviderRoutesService } from './provider-routes.service.js';
import { ProviderRouteQueryDto } from './dto/provider-route-query.dto.js';
import { ProviderCentresQueryDto } from './dto/provider-centres-query.dto.js';
import { ProviderCategoriesQueryDto } from './dto/provider-categories-query.dto.js';
import type { ProviderRouteResponseDto } from './dto/provider-route-response.dto.js';

@Controller('provider-routes')
export class ProviderRoutesController {
  constructor(private readonly providerRoutesService: ProviderRoutesService) {}

  @Get('centres')
  async getCentres(
    @Query() query: ProviderCentresQueryDto,
  ): Promise<{ items: { applicationCentre: string }[] }> {
    return this.providerRoutesService.getCentres(query);
  }

  @Get('categories')
  async getCategories(
    @Query() query: ProviderCategoriesQueryDto,
  ): Promise<{ items: { visaCategory: string; visaSubcategory: string }[] }> {
    return this.providerRoutesService.getCategories(query);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<ProviderRouteResponseDto> {
    return this.providerRoutesService.findById(id);
  }

  @Get()
  async list(
    @Query() query: ProviderRouteQueryDto,
  ): Promise<ProviderRouteResponseDto[]> {
    return this.providerRoutesService.list(query);
  }
}

import { Injectable } from '@nestjs/common';
import { ProviderRoutesRepository } from './provider-routes.repository.js';
import { ProviderRouteNotFoundError } from './errors/provider-route-not-found.error.js';
import type { ProviderRouteQueryDto } from './dto/provider-route-query.dto.js';
import type { ProviderCentresQueryDto } from './dto/provider-centres-query.dto.js';
import type { ProviderCategoriesQueryDto } from './dto/provider-categories-query.dto.js';
import type { ProviderRouteResponseDto } from './dto/provider-route-response.dto.js';
import type { ProviderRoute, Prisma } from '@visaflow/database';
import { ProviderCode, BookingMode, type ProviderRouteConfig } from '@visaflow/shared-types';

@Injectable()
export class ProviderRoutesService {
  constructor(private readonly providerRoutesRepo: ProviderRoutesRepository) {}

  async list(query: ProviderRouteQueryDto): Promise<ProviderRouteResponseDto[]> {
    const where: Prisma.ProviderRouteWhereInput = {};

    if (query.provider) {
      where.provider = { code: query.provider };
    }
    if (query.sourceCountry) {
      where.sourceCountry = query.sourceCountry;
    }
    if (query.destinationCountry) {
      where.destinationCountry = query.destinationCountry;
    }
    if (query.applicationCentre) {
      where.applicationCentre = query.applicationCentre;
    }
    if (query.visaCategory) {
      where.visaCategory = query.visaCategory;
    }
    if (query.visaSubcategory) {
      where.visaSubcategory = query.visaSubcategory;
    }
    if (query.bookingMode) {
      where.bookingMode = query.bookingMode;
    }
    if (query.enabled !== undefined) {
      where.enabled = query.enabled;
    }

    const routes = await this.providerRoutesRepo.findMany(where);
    return routes.map((r) => this.mapToResponse(r));
  }

  async findById(id: string): Promise<ProviderRouteResponseDto> {
    const route = await this.providerRoutesRepo.findById(id);
    if (!route) {
      throw new ProviderRouteNotFoundError(id);
    }
    return this.mapToResponse(route);
  }

  async getCentres(query: ProviderCentresQueryDto): Promise<{ items: { applicationCentre: string }[] }> {
    const where: Prisma.ProviderRouteWhereInput = {};
    if (query.provider) {
      where.provider = { code: query.provider };
    }
    if (query.sourceCountry) {
      where.sourceCountry = query.sourceCountry;
    }
    if (query.destinationCountry) {
      where.destinationCountry = query.destinationCountry;
    }

    const items = await this.providerRoutesRepo.findDistinctCentres(where);
    return { items };
  }

  async getCategories(
    query: ProviderCategoriesQueryDto,
  ): Promise<{ items: { visaCategory: string; visaSubcategory: string }[] }> {
    const where: Prisma.ProviderRouteWhereInput = {};
    if (query.provider) {
      where.provider = { code: query.provider };
    }
    if (query.sourceCountry) {
      where.sourceCountry = query.sourceCountry;
    }
    if (query.destinationCountry) {
      where.destinationCountry = query.destinationCountry;
    }
    if (query.applicationCentre) {
      where.applicationCentre = query.applicationCentre;
    }

    const items = await this.providerRoutesRepo.findDistinctCategories(where);
    return { items };
  }

  private mapToResponse(
    route: ProviderRoute & { provider: { code: string; name: string } },
  ): ProviderRouteResponseDto {
    return {
      id: route.id,
      providerId: route.providerId,
      providerCode: route.provider.code as ProviderCode,
      providerName: route.provider.name,
      sourceCountry: route.sourceCountry,
      destinationCountry: route.destinationCountry,
      applicationCentre: route.applicationCentre,
      visaCategory: route.visaCategory,
      visaSubcategory: route.visaSubcategory,
      bookingMode: route.bookingMode as BookingMode,
      enabled: route.enabled,
      configurationJson: route.configurationJson as ProviderRouteConfig | null,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
    };
  }
}

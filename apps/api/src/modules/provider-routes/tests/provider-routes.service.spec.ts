import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderRoutesService } from '../provider-routes.service.js';
import { ProviderRoutesRepository } from '../provider-routes.repository.js';
import { ProviderRouteNotFoundError } from '../errors/provider-route-not-found.error.js';
import { ProviderCode, BookingMode } from '@visaflow/shared-types';

describe('ProviderRoutesService', () => {
  let service: ProviderRoutesService;
  let repo: Partial<ProviderRoutesRepository>;

  const mockRoute = {
    id: 'route_123',
    providerId: 'prov_vfs',
    provider: { code: 'VFS', name: 'VFS Global' },
    sourceCountry: 'MA',
    destinationCountry: 'ES',
    applicationCentre: 'Casablanca',
    visaCategory: 'BUSINESS',
    visaSubcategory: 'CONFERENCE',
    bookingMode: BookingMode.APPOINTMENT_CALENDAR,
    enabled: true,
    configurationJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      findMany: vi.fn().mockResolvedValue([mockRoute]),
      findById: vi.fn().mockResolvedValue(mockRoute),
      findDistinctCentres: vi.fn().mockResolvedValue([{ applicationCentre: 'Casablanca' }]),
      findDistinctCategories: vi.fn().mockResolvedValue([
        { visaCategory: 'BUSINESS', visaSubcategory: 'CONFERENCE' },
      ]),
    };

    service = new ProviderRoutesService(repo as ProviderRoutesRepository);
  });

  it('Test A: queries repository with enabled flag', async () => {
    const routes = await service.list({ enabled: true });

    expect(repo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
    expect(routes.length).toBe(1);
    expect(routes[0]!.id).toBe('route_123');
  });

  it('Test B: retrieves distinct centres directly from repository', async () => {
    const centres = await service.getCentres({ provider: ProviderCode.VFS });

    expect(repo.findDistinctCentres).toHaveBeenCalledWith({
      provider: { code: ProviderCode.VFS },
    });
    expect(centres.items).toEqual([{ applicationCentre: 'Casablanca' }]);
  });

  it('Test C: retrieves distinct visa categories directly from repository', async () => {
    const categories = await service.getCategories({
      provider: ProviderCode.VFS,
      sourceCountry: 'MA',
      destinationCountry: 'ES',
    });

    expect(repo.findDistinctCategories).toHaveBeenCalledWith({
      provider: { code: ProviderCode.VFS },
      sourceCountry: 'MA',
      destinationCountry: 'ES',
    });
    expect(categories.items).toEqual([
      { visaCategory: 'BUSINESS', visaSubcategory: 'CONFERENCE' },
    ]);
  });

  it('Test D: queries are fully data-driven without static route or country constants', async () => {
    await service.list({
      sourceCountry: 'TR',
      destinationCountry: 'DE',
      applicationCentre: 'Istanbul',
    });

    expect(repo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceCountry: 'TR',
        destinationCountry: 'DE',
        applicationCentre: 'Istanbul',
      }),
    );
  });

  it('Test E: throws ProviderRouteNotFoundError when route is missing', async () => {
    vi.spyOn(repo as any, 'findById').mockResolvedValue(null);

    await expect(service.findById('non_existent')).rejects.toThrow(ProviderRouteNotFoundError);
  });
});

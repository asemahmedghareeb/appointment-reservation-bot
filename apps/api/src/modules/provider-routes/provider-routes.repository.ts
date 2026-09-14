import { Injectable } from '@nestjs/common';
import { prisma, type ProviderRoute, type Prisma } from '@visaflow/database';

@Injectable()
export class ProviderRoutesRepository {
  async findMany(where?: Prisma.ProviderRouteWhereInput): Promise<
    (ProviderRoute & {
      provider: { code: string; name: string };
    })[]
  > {
    const args: Prisma.ProviderRouteFindManyArgs = {
      include: {
        provider: {
          select: { code: true, name: true },
        },
      },
      orderBy: [
        { destinationCountry: 'asc' },
        { applicationCentre: 'asc' },
        { visaCategory: 'asc' },
      ],
    };
    if (where) {
      args.where = where;
    }
    return prisma.providerRoute.findMany(args) as unknown as Promise<
      (ProviderRoute & {
        provider: { code: string; name: string };
      })[]
    >;
  }

  async findById(id: string): Promise<
    | (ProviderRoute & {
        provider: { code: string; name: string };
      })
    | null
  > {
    return prisma.providerRoute.findUnique({
      where: { id },
      include: {
        provider: {
          select: { code: true, name: true },
        },
      },
    });
  }

  async findDistinctCentres(where?: Prisma.ProviderRouteWhereInput): Promise<{ applicationCentre: string }[]> {
    const results = await prisma.providerRoute.findMany({
      where: {
        ...where,
        enabled: true,
      },
      select: { applicationCentre: true },
      distinct: ['applicationCentre'],
      orderBy: { applicationCentre: 'asc' },
    });

    return results;
  }

  async findDistinctCategories(
    where?: Prisma.ProviderRouteWhereInput,
  ): Promise<{ visaCategory: string; visaSubcategory: string }[]> {
    const results = await prisma.providerRoute.findMany({
      where: {
        ...where,
        enabled: true,
      },
      select: { visaCategory: true, visaSubcategory: true },
      distinct: ['visaCategory', 'visaSubcategory'],
      orderBy: [{ visaCategory: 'asc' }, { visaSubcategory: 'asc' }],
    });

    return results;
  }
}

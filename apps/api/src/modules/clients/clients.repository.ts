import { Injectable } from '@nestjs/common';
import { prisma, type Client, type Prisma } from '@visaflow/database';

@Injectable()
export class ClientsRepository {
  async create(data: Prisma.ClientCreateInput): Promise<Client> {
    return prisma.client.create({ data });
  }

  async findById(id: string): Promise<Client | null> {
    return prisma.client.findUnique({ where: { id } });
  }

  async findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.ClientWhereInput;
    orderBy?: Prisma.ClientOrderByWithRelationInput;
  }): Promise<Client[]> {
    const args: Prisma.ClientFindManyArgs = {
      skip: params.skip,
      take: params.take,
      orderBy: params.orderBy ?? { createdAt: 'desc' },
    };
    if (params.where) {
      args.where = params.where;
    }
    return prisma.client.findMany(args);
  }

  async count(where?: Prisma.ClientWhereInput): Promise<number> {
    if (where) {
      return prisma.client.count({ where });
    }
    return prisma.client.count();
  }

  async update(id: string, data: Prisma.ClientUpdateInput): Promise<Client> {
    return prisma.client.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Client> {
    return prisma.client.delete({ where: { id } });
  }

  async countApplicants(clientId: string): Promise<number> {
    return prisma.applicant.count({ where: { clientId } });
  }
}

import { Injectable } from '@nestjs/common';
import { ClientsRepository } from './clients.repository.js';
import { CurrentUserService } from '../../common/context/current-user.service.js';
import { ClientNotFoundError } from './errors/client-not-found.error.js';
import { ClientHasDependentsError } from './errors/client-has-dependents.error.js';
import { normalizePagination, createPaginatedResult } from '../../common/utils/pagination.js';
import type { CreateClientDto } from './dto/create-client.dto.js';
import type { UpdateClientDto } from './dto/update-client.dto.js';
import type { ListClientsQueryDto } from './dto/list-clients-query.dto.js';
import type { ClientResponseDto } from './dto/client-response.dto.js';
import type { PaginatedResult } from '@visaflow/shared-types';
import type { Prisma, Client } from '@visaflow/database';

@Injectable()
export class ClientsService {
  constructor(
    private readonly clientsRepo: ClientsRepository,
    private readonly currentUserService: CurrentUserService,
  ) {}

  async create(dto: CreateClientDto, creatorIdOverride?: string): Promise<ClientResponseDto> {
    const actor = await this.currentUserService.getActor(creatorIdOverride);

    const client = await this.clientsRepo.create({
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      createdBy: {
        connect: { id: actor.id },
      },
    });

    return this.mapToResponse(client);
  }

  async findById(id: string): Promise<ClientResponseDto> {
    const client = await this.clientsRepo.findById(id);
    if (!client) {
      throw new ClientNotFoundError(id);
    }
    return this.mapToResponse(client);
  }

  async list(query: ListClientsQueryDto): Promise<PaginatedResult<ClientResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const where: Prisma.ClientWhereInput = {};

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.clientsRepo.findMany({ skip, take: limit, where }),
      this.clientsRepo.count(where),
    ]);

    return createPaginatedResult(
      items.map((c) => this.mapToResponse(c)),
      total,
      page,
      limit,
    );
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    await this.findById(id);

    const data: Prisma.ClientUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;

    const updated = await this.clientsRepo.update(id, data);
    return this.mapToResponse(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    const dependentCount = await this.clientsRepo.countApplicants(id);
    if (dependentCount > 0) {
      throw new ClientHasDependentsError(id, dependentCount);
    }

    await this.clientsRepo.delete(id);
  }

  private mapToResponse(client: Client): ClientResponseDto {
    return {
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      createdById: client.createdById,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }
}

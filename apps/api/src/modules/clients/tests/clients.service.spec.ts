import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientsService } from '../clients.service.js';
import { ClientsRepository } from '../clients.repository.js';
import { CurrentUserService } from '../../../common/context/current-user.service.js';
import { ClientNotFoundError } from '../errors/client-not-found.error.js';
import { ClientHasDependentsError } from '../errors/client-has-dependents.error.js';
import { UserRole } from '@visaflow/database';

describe('ClientsService', () => {
  let service: ClientsService;
  let repo: Partial<ClientsRepository>;
  let currentUserService: Partial<CurrentUserService>;

  const mockClient = {
    id: 'cuid_client_1',
    fullName: 'Ahmed Ali',
    phone: '+20100000000',
    email: 'ahmed@example.com',
    createdById: 'user_1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue(mockClient),
      findById: vi.fn().mockResolvedValue(mockClient),
      findMany: vi.fn().mockResolvedValue([mockClient]),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue({ ...mockClient, fullName: 'Ahmed Updated' }),
      delete: vi.fn().mockResolvedValue(mockClient),
      countApplicants: vi.fn().mockResolvedValue(0),
    };

    currentUserService = {
      getActor: vi.fn().mockResolvedValue({
        id: 'user_1',
        name: 'Agent Tarek',
        email: 'agent@visaflow.com',
        role: UserRole.BOOKING_AGENT,
      }),
    };

    service = new ClientsService(
      repo as ClientsRepository,
      currentUserService as CurrentUserService,
    );
  });

  it('creates a client connecting authenticated creator', async () => {
    const res = await service.create({
      fullName: 'Ahmed Ali',
      phone: '+20100000000',
      email: 'ahmed@example.com',
    });

    expect(repo.create).toHaveBeenCalledWith({
      fullName: 'Ahmed Ali',
      phone: '+20100000000',
      email: 'ahmed@example.com',
      createdBy: { connect: { id: 'user_1' } },
    });
    expect(res.id).toBe('cuid_client_1');
    expect(res.fullName).toBe('Ahmed Ali');
  });

  it('throws ClientNotFoundError when client does not exist', async () => {
    vi.spyOn(repo as any, 'findById').mockResolvedValue(null);

    await expect(service.findById('non_existent')).rejects.toThrow(ClientNotFoundError);
  });

  it('lists clients with normalized pagination and search filters', async () => {
    const res = await service.list({ page: 1, limit: 10, search: 'Ahmed' });

    expect(repo.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 10,
      where: expect.objectContaining({
        OR: expect.any(Array),
      }),
    });
    expect(res.items.length).toBe(1);
    expect(res.total).toBe(1);
    expect(res.totalPages).toBe(1);
  });

  it('updates a client successfully', async () => {
    const res = await service.update('cuid_client_1', { fullName: 'Ahmed Updated' });

    expect(repo.update).toHaveBeenCalledWith('cuid_client_1', { fullName: 'Ahmed Updated' });
    expect(res.fullName).toBe('Ahmed Updated');
  });

  it('deletes a client with zero dependents', async () => {
    await service.delete('cuid_client_1');

    expect(repo.delete).toHaveBeenCalledWith('cuid_client_1');
  });

  it('rejects client deletion if dependent applicants exist', async () => {
    vi.spyOn(repo as any, 'countApplicants').mockResolvedValue(3);

    await expect(service.delete('cuid_client_1')).rejects.toThrow(ClientHasDependentsError);
  });
});

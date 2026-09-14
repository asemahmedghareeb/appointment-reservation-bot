import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientsController } from '../clients.controller.js';
import { ClientsService } from '../clients.service.js';

describe('ClientsController', () => {
  let controller: ClientsController;
  let service: Partial<ClientsService>;

  const mockResponse = {
    id: 'client_1',
    fullName: 'Youssef Nader',
    phone: '+201111111111',
    email: 'youssef@example.com',
    createdById: 'user_1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    service = {
      create: vi.fn().mockResolvedValue(mockResponse),
      findById: vi.fn().mockResolvedValue(mockResponse),
      list: vi.fn().mockResolvedValue({
        items: [mockResponse],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      }),
      update: vi.fn().mockResolvedValue(mockResponse),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    controller = new ClientsController(service as ClientsService);
  });

  it('delegates create to service', async () => {
    const res = await controller.create({
      fullName: 'Youssef Nader',
      phone: '+201111111111',
      email: 'youssef@example.com',
    });

    expect(service.create).toHaveBeenCalledWith(
      {
        fullName: 'Youssef Nader',
        phone: '+201111111111',
        email: 'youssef@example.com',
      },
      undefined,
    );
    expect(res.id).toBe('client_1');
  });

  it('delegates findById to service', async () => {
    const res = await controller.findById('client_1');
    expect(service.findById).toHaveBeenCalledWith('client_1');
    expect(res.id).toBe('client_1');
  });

  it('delegates list to service', async () => {
    const res = await controller.list({ page: 1, limit: 10 });
    expect(service.list).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(res.items.length).toBe(1);
  });

  it('delegates update to service', async () => {
    const res = await controller.update('client_1', { fullName: 'New Name' });
    expect(service.update).toHaveBeenCalledWith('client_1', { fullName: 'New Name' });
    expect(res.id).toBe('client_1');
  });

  it('delegates delete to service', async () => {
    await controller.delete('client_1');
    expect(service.delete).toHaveBeenCalledWith('client_1');
  });
});

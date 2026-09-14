import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApplicantsController } from '../applicants.controller.js';
import { ApplicantsService } from '../applicants.service.js';
import { Gender } from '@visaflow/shared-types';

describe('ApplicantsController', () => {
  let controller: ApplicantsController;
  let service: Partial<ApplicantsService>;

  const mockResponse = {
    id: 'app_1',
    clientId: 'client_1',
    firstName: 'Hassan',
    lastName: 'Kareem',
    gender: Gender.MALE,
    dateOfBirth: new Date('1995-05-20'),
    nationality: 'EG',
    phone: '+201222222222',
    email: 'hassan@example.com',
    passportMasked: 'A12***67',
    passportExpiry: new Date('2032-10-10'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    service = {
      create: vi.fn().mockResolvedValue(mockResponse),
      findById: vi.fn().mockResolvedValue(mockResponse),
      findByPassport: vi.fn().mockResolvedValue(mockResponse),
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

    controller = new ApplicantsController(service as ApplicantsService);
  });

  it('delegates create to service', async () => {
    const res = await controller.create({
      firstName: 'Hassan',
      lastName: 'Kareem',
      gender: Gender.MALE,
      dateOfBirth: '1995-05-20',
      nationality: 'EG',
      passportNumber: 'A1234567',
      passportExpiry: '2032-10-10',
    });

    expect(service.create).toHaveBeenCalled();
    expect(res.id).toBe('app_1');
  });

  it('delegates findById to service', async () => {
    const res = await controller.findById('app_1');
    expect(service.findById).toHaveBeenCalledWith('app_1');
    expect(res.id).toBe('app_1');
  });

  it('delegates findByPassport to service', async () => {
    const res = await controller.findByPassport({ passportNumber: 'A1234567' });
    expect(service.findByPassport).toHaveBeenCalledWith({ passportNumber: 'A1234567' });
    expect(res.id).toBe('app_1');
  });

  it('delegates list to service', async () => {
    const res = await controller.list({ page: 1, limit: 10 });
    expect(service.list).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(res.items.length).toBe(1);
  });

  it('delegates update to service', async () => {
    const res = await controller.update('app_1', { firstName: 'Updated' });
    expect(service.update).toHaveBeenCalledWith('app_1', { firstName: 'Updated' });
    expect(res.id).toBe('app_1');
  });

  it('delegates delete to service', async () => {
    await controller.delete('app_1');
    expect(service.delete).toHaveBeenCalledWith('app_1');
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingCasesController } from '../booking-cases.controller.js';
import { BookingCasesService } from '../booking-cases.service.js';
import {
  BookingCaseStatus,
  BookingMode,
  ProviderCode,
  ApplicantRelation,
} from '@visaflow/shared-types';

describe('BookingCasesController', () => {
  let controller: BookingCasesController;
  let service: Partial<BookingCasesService>;

  const mockResponse = {
    id: 'case_1',
    caseNumber: 'VF_123',
    status: BookingCaseStatus.DRAFT,
    bookingMode: BookingMode.APPOINTMENT_CALENDAR,
    preferredDateFrom: null,
    preferredDateTo: null,
    preferredTime: null,
    allowGroupSplit: false,
    createdById: 'user_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    providerRoute: {
      id: 'route_1',
      providerCode: ProviderCode.VFS,
      providerName: 'VFS Global',
      sourceCountry: 'EG',
      destinationCountry: 'FR',
      applicationCentre: 'Cairo',
      visaCategory: 'TOURISM',
      visaSubcategory: 'SHORT_STAY',
    },
    applicants: [],
    applicantCount: 0,
    primaryApplicantId: null,
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
      addApplicant: vi.fn().mockResolvedValue(mockResponse),
      setPrimaryApplicant: vi.fn().mockResolvedValue(mockResponse),
      reorderApplicants: vi.fn().mockResolvedValue(mockResponse),
      removeApplicant: vi.fn().mockResolvedValue(mockResponse),
      markReady: vi.fn().mockResolvedValue({
        ...mockResponse,
        status: BookingCaseStatus.READY,
      }),
    };

    controller = new BookingCasesController(service as BookingCasesService);
  });

  it('delegates create to service', async () => {
    const res = await controller.create({ providerRouteId: 'route_1' });
    expect(service.create).toHaveBeenCalled();
    expect(res.id).toBe('case_1');
  });

  it('delegates findById to service', async () => {
    const res = await controller.findById('case_1');
    expect(service.findById).toHaveBeenCalledWith('case_1');
    expect(res.id).toBe('case_1');
  });

  it('delegates addApplicant to service', async () => {
    await controller.addApplicant('case_1', {
      applicantId: 'app_1',
      relation: ApplicantRelation.PRIMARY,
    });
    expect(service.addApplicant).toHaveBeenCalledWith('case_1', {
      applicantId: 'app_1',
      relation: ApplicantRelation.PRIMARY,
    });
  });

  it('delegates setPrimaryApplicant to service', async () => {
    await controller.setPrimaryApplicant('case_1', 'ba_1');
    expect(service.setPrimaryApplicant).toHaveBeenCalledWith('case_1', 'ba_1');
  });

  it('delegates reorderApplicants to service', async () => {
    await controller.reorderApplicants('case_1', {
      items: [{ bookingApplicantId: 'ba_1', position: 1 }],
    });
    expect(service.reorderApplicants).toHaveBeenCalledWith('case_1', {
      items: [{ bookingApplicantId: 'ba_1', position: 1 }],
    });
  });

  it('delegates markReady to service', async () => {
    const res = await controller.markReady('case_1', { reason: 'Ready' });
    expect(service.markReady).toHaveBeenCalledWith('case_1', { reason: 'Ready' }, undefined);
    expect(res.status).toBe(BookingCaseStatus.READY);
  });
});

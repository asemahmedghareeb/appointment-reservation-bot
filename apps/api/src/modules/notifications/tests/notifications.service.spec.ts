import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsService } from '../notifications.service';
import type { NotificationsRepository } from '../notifications.repository';
import type { OperationsEventsService } from '../../operations/operations-events.service';
import { OperationsEventType } from '@visaflow/shared-types';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: Partial<NotificationsRepository>;
  let events: Partial<OperationsEventsService>;

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    bookingCaseId: 'case-1',
    type: 'HUMAN_ACTION_REQUIRED',
    title: 'Verification Needed',
    message: 'OTP requested',
    readAt: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue(mockNotification),
      findById: vi.fn().mockResolvedValue(mockNotification),
      findMany: vi.fn().mockResolvedValue([mockNotification]),
      count: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn().mockResolvedValue({
        ...mockNotification,
        readAt: new Date(),
      }),
      markAllAsRead: vi.fn().mockResolvedValue(3),
    };

    events = {
      emit: vi.fn(),
    };

    service = new NotificationsService(
      repo as NotificationsRepository,
      events as OperationsEventsService,
    );
  });

  it('should create notification and emit real-time event', async () => {
    const res = await service.createNotification({
      userId: 'user-1',
      bookingCaseId: 'case-1',
      type: 'HUMAN_ACTION_REQUIRED',
      title: 'Verification Needed',
      message: 'OTP requested',
    });

    expect(repo.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      OperationsEventType.NOTIFICATION_CREATED,
      'case-1',
      expect.objectContaining({ id: 'notif-1' }),
    );
    expect(res.id).toBe('notif-1');
  });

  it('should list notifications with pagination', async () => {
    const res = await service.list({ page: 1, limit: 10 });
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('should mark single notification as read', async () => {
    const res = await service.markAsRead('notif-1');
    expect(repo.markAsRead).toHaveBeenCalledWith('notif-1');
    expect(res.readAt).not.toBeNull();
  });

  it('should mark all notifications as read', async () => {
    const res = await service.markAllAsRead('user-1');
    expect(repo.markAllAsRead).toHaveBeenCalledWith('user-1', undefined);
    expect(res.updatedCount).toBe(3);
  });
});

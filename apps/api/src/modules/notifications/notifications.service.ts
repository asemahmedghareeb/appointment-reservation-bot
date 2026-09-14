import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { OperationsEventsService } from '../operations/operations-events.service';
import { OperationsEventType, type PaginatedResult } from '@visaflow/shared-types';
import { normalizePagination, createPaginatedResult } from '../../common/utils/pagination';
import type { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import type { NotificationResponseDto } from './dto/notification-response.dto';
import type { Notification } from '@visaflow/database';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepo: NotificationsRepository,
    private readonly operationsEventsService: OperationsEventsService,
  ) {}

  async createNotification(data: {
    userId?: string | null;
    bookingCaseId?: string | null;
    type: string;
    title: string;
    message: string;
  }): Promise<NotificationResponseDto> {
    const notification = await this.notificationsRepo.create(data);
    const dto = this.mapToDto(notification);

    this.operationsEventsService.emit(
      OperationsEventType.NOTIFICATION_CREATED,
      data.bookingCaseId ?? undefined,
      dto,
    );

    return dto;
  }

  async list(query: ListNotificationsQueryDto): Promise<PaginatedResult<NotificationResponseDto>> {
    const { skip, page, limit } = normalizePagination(query.page, query.limit);

    const [items, total] = await Promise.all([
      this.notificationsRepo.findMany({
        skip,
        take: limit,
        unreadOnly: query.unreadOnly,

        userId: query.userId,
        bookingCaseId: query.bookingCaseId,
      }),
      this.notificationsRepo.count({
        unreadOnly: query.unreadOnly,
        userId: query.userId,
        bookingCaseId: query.bookingCaseId,
      }),
    ]);

    return createPaginatedResult(
      items.map((item) => this.mapToDto(item)),
      total,
      page,
      limit,
    );
  }

  async markAsRead(id: string): Promise<NotificationResponseDto> {
    const existing = await this.notificationsRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    const updated = await this.notificationsRepo.markAsRead(id);
    return this.mapToDto(updated);
  }

  async markAllAsRead(userId?: string, bookingCaseId?: string): Promise<{ updatedCount: number }> {
    const count = await this.notificationsRepo.markAllAsRead(userId, bookingCaseId);
    return { updatedCount: count };
  }

  private mapToDto(entity: Notification): NotificationResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      bookingCaseId: entity.bookingCaseId,
      type: entity.type,
      title: entity.title,
      message: entity.message,
      readAt: entity.readAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}

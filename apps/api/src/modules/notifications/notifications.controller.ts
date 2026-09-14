import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
import type { NotificationResponseDto } from './dto/notification-response.dto.js';
import type { PaginatedResult } from '@visaflow/shared-types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    return this.notificationsService.list(query);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(
    @Body() body?: { userId?: string; bookingCaseId?: string },
  ): Promise<{ updatedCount: number }> {
    return this.notificationsService.markAllAsRead(body?.userId, body?.bookingCaseId);
  }
}

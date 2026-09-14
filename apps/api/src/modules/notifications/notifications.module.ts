import { Module } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}

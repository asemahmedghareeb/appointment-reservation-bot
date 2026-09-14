import { Module } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';

@Module({
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

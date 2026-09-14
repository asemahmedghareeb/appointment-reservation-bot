import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { CommonModule } from './common/common.module.js';
import { DomainModule } from './modules/domain/domain.module.js';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';

@Module({
  imports: [
    CommonModule,
    HealthModule,
    OperationsModule,
    DomainModule,
    OrchestratorModule,
    DashboardModule,
    NotificationsModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { CommonModule } from './common/common.module.js';
import { DomainModule } from './modules/domain/domain.module.js';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module.js';

@Module({
  imports: [CommonModule, HealthModule, DomainModule, OrchestratorModule],
})
export class AppModule {}


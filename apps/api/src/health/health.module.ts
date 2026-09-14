import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { OperationsModule } from '../modules/operations/operations.module.js';

@Module({
  imports: [OperationsModule],
  controllers: [HealthController],
})
export class HealthModule {}


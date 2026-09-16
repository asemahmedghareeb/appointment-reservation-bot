import { Module, Global } from '@nestjs/common';
import { OperationsService } from './operations.service.js';
import { OperationsEventsService } from './operations-events.service.js';
import { OperationsController } from './operations.controller.js';
import { OperationalHealthService } from './health/operational-health.service.js';
import { ProviderHealthService } from './health/provider-health.service.js';
import { QueueHealthService } from './health/queue-health.service.js';
import { MetricsService } from './metrics/metrics.service.js';
import { MetricsController } from './metrics/metrics.controller.js';
import { StuckCaseDetectorService } from './recovery/stuck-case-detector.service.js';
import { RecoveryService } from './recovery/recovery.service.js';
import { LiveMonitorController } from './live-monitor/live-monitor.controller.js';
import { LiveMonitorService } from './live-monitor/live-monitor.service.js';

@Global()
@Module({
  controllers: [OperationsController, MetricsController, LiveMonitorController],
  providers: [
    OperationsService,
    OperationsEventsService,
    OperationalHealthService,
    ProviderHealthService,
    QueueHealthService,
    MetricsService,
    StuckCaseDetectorService,
    RecoveryService,
    LiveMonitorService,
  ],
  exports: [
    OperationsService,
    OperationsEventsService,
    OperationalHealthService,
    ProviderHealthService,
    QueueHealthService,
    MetricsService,
    RecoveryService,
    LiveMonitorService,
  ],
})
export class OperationsModule {}

import { Injectable, Optional } from '@nestjs/common';
import { OrchestrationQueueService } from '../../orchestrator/infrastructure/queues/orchestration-queue.service.js';
import type { QueueHealthMetrics } from '@visaflow/shared-types';

export interface ComprehensiveQueueHealth {
  status: 'HEALTHY' | 'DEGRADED';
  timestamp: string;
  queues: Record<string, QueueHealthMetrics>;
}

@Injectable()
export class QueueHealthService {
  constructor(
    @Optional() private readonly orchestrationQueueService?: OrchestrationQueueService,
  ) {}

  async getQueueHealth(): Promise<ComprehensiveQueueHealth> {
    if (!this.orchestrationQueueService) {
      return {
        status: 'HEALTHY',
        timestamp: new Date().toISOString(),
        queues: {},
      };
    }

    const factory = this.orchestrationQueueService.getFactory();
    const queues = [
      { name: 'availability-check', q: factory.getAvailabilityQueue() },
      { name: 'booking-execution', q: factory.getBookingQueue() },
      { name: 'session-resume', q: factory.getResumeQueue() },
    ];

    const result: Record<string, QueueHealthMetrics> = {};
    let isDegraded = false;

    for (const { name, q } of queues) {
      try {
        const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
        result[name] = {
          queueName: name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          completed: counts.completed ?? 0,
        };
        if ((counts.failed ?? 0) > 100) {
          isDegraded = true;
        }
      } catch {
        result[name] = {
          queueName: name,
          waiting: 0,
          active: 0,
          delayed: 0,
          failed: 0,
          completed: 0,
        };
      }
    }

    return {
      status: isDegraded ? 'DEGRADED' : 'HEALTHY',
      timestamp: new Date().toISOString(),
      queues: result,
    };
  }
}

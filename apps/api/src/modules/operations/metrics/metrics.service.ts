import { Injectable } from '@nestjs/common';
import {
  Registry,
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  readonly apiRequestsTotal: Counter<string>;
  readonly caseLockConflictsTotal: Counter<string>;
  readonly bookingOutcomesTotal: Counter<string>;
  readonly providerPageChangesTotal: Counter<string>;
  readonly apiRequestDurationSeconds: Histogram<string>;
  readonly activeOperationsGauge: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({ register: this.registry, prefix: 'visaflow_api_' });

    this.apiRequestsTotal = new Counter({
      name: 'visaflow_api_requests_total',
      help: 'Total incoming API HTTP requests',
      labelNames: ['method', 'route', 'status_code'] as const,
      registers: [this.registry],
    });

    this.caseLockConflictsTotal = new Counter({
      name: 'visaflow_api_case_lock_conflicts_total',
      help: 'Total lock acquisition conflicts on booking cases',
      registers: [this.registry],
    });

    this.bookingOutcomesTotal = new Counter({
      name: 'visaflow_api_booking_outcomes_total',
      help: 'Total booking operation outcomes recorded',
      labelNames: ['provider', 'outcome'] as const,
      registers: [this.registry],
    });

    this.providerPageChangesTotal = new Counter({
      name: 'visaflow_api_provider_page_changed_total',
      help: 'Total unexpected page structure change incidents',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.apiRequestDurationSeconds = new Histogram({
      name: 'visaflow_api_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'] as const,
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.activeOperationsGauge = new Gauge({
      name: 'visaflow_api_active_operations',
      help: 'Current active operations in progress',
      labelNames: ['operation'] as const,
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}

import {
  Registry,
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

export class WorkerMetricsService {
  private readonly registry: Registry;

  // Counters
  readonly completedJobs: Counter<string>;
  readonly failedJobs: Counter<string>;
  readonly lockConflicts: Counter<string>;
  readonly browserSessionFailures: Counter<string>;
  readonly slotDetections: Counter<string>;
  readonly slotLostCount: Counter<string>;
  readonly bookingSuccessCount: Counter<string>;
  readonly paymentRequiredCount: Counter<string>;
  readonly confirmedCount: Counter<string>;
  readonly humanVerificationCount: Counter<string>;
  readonly providerPageChangedCount: Counter<string>;

  // Gauges
  readonly activeJobs: Gauge<string>;
  readonly queueDepth: Gauge<string>;
  readonly activeBrowserSessions: Gauge<string>;

  // Histogram
  readonly jobDurationSeconds: Histogram<string>;

  constructor(customRegistry?: Registry) {
    this.registry = customRegistry ?? new Registry();

    collectDefaultMetrics({ register: this.registry, prefix: 'visaflow_worker_' });

    this.completedJobs = new Counter({
      name: 'visaflow_worker_jobs_completed_total',
      help: 'Total number of successfully completed worker jobs',
      labelNames: ['queue', 'operation'] as const,
      registers: [this.registry],
    });

    this.failedJobs = new Counter({
      name: 'visaflow_worker_jobs_failed_total',
      help: 'Total number of failed worker jobs',
      labelNames: ['queue', 'operation', 'classification'] as const,
      registers: [this.registry],
    });

    this.lockConflicts = new Counter({
      name: 'visaflow_case_lock_conflicts_total',
      help: 'Total number of case lock acquisition conflicts',
      registers: [this.registry],
    });

    this.browserSessionFailures = new Counter({
      name: 'visaflow_browser_session_failures_total',
      help: 'Total number of automation browser session failures',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.slotDetections = new Counter({
      name: 'visaflow_slots_detected_total',
      help: 'Total number of appointment slots discovered',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.slotLostCount = new Counter({
      name: 'visaflow_slots_lost_total',
      help: 'Total number of slots lost during booking process',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.bookingSuccessCount = new Counter({
      name: 'visaflow_booking_success_total',
      help: 'Total number of successful bookings reaching payment or confirmation',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.paymentRequiredCount = new Counter({
      name: 'visaflow_payment_required_total',
      help: 'Total number of cases reaching payment required state',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.confirmedCount = new Counter({
      name: 'visaflow_cases_confirmed_total',
      help: 'Total number of cases successfully confirmed',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.humanVerificationCount = new Counter({
      name: 'visaflow_human_verification_total',
      help: 'Total count of human action challenges encountered',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.providerPageChangedCount = new Counter({
      name: 'visaflow_provider_page_changed_total',
      help: 'Total number of unexpected provider page structure changes detected',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.activeJobs = new Gauge({
      name: 'visaflow_worker_jobs_active',
      help: 'Number of worker jobs currently executing',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name: 'visaflow_queue_depth',
      help: 'Current depth of waiting jobs in queue',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.activeBrowserSessions = new Gauge({
      name: 'visaflow_browser_sessions_active',
      help: 'Current number of active Playwright browser contexts',
      registers: [this.registry],
    });

    this.jobDurationSeconds = new Histogram({
      name: 'visaflow_worker_job_duration_seconds',
      help: 'Duration of completed worker jobs in seconds',
      labelNames: ['queue', 'operation'] as const,
      buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
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

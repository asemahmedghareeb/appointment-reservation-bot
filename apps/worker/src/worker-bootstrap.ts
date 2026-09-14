import { ProviderCode } from '@visaflow/shared-types';
import { loadWorkerConfig, type WorkerConfig } from './config/worker.config.js';
import { WorkerRepository } from './repositories/worker.repository.js';
import { SecureProviderAccountService } from './services/secure-provider-account.service.js';
import { AutomationSessionService } from './services/automation-session.service.js';
import { PaymentHandoffService } from './services/payment-handoff.service.js';
import { ProviderContextLoaderService } from './services/provider-context-loader.service.js';
import { ProviderAdapterRegistryService } from './services/provider-adapter-registry.service.js';
import { VfsBrowserSessionManager, VfsProviderAdapter, createVfsConfig } from '@visaflow/vfs-adapter';
import { AvailabilityWorker } from './queues/availability.worker.js';
import { BookingWorker } from './queues/booking.worker.js';
import { SessionResumeWorker } from './queues/session-resume.worker.js';

export class WorkerBootstrap {
  private config: WorkerConfig;
  private availabilityWorker?: AvailabilityWorker;
  private bookingWorker?: BookingWorker;
  private sessionResumeWorker?: SessionResumeWorker;
  private sessionManager?: VfsBrowserSessionManager;

  constructor(configOverride?: Partial<WorkerConfig>) {
    this.config = { ...loadWorkerConfig(), ...configOverride };
  }

  async start(): Promise<void> {
    console.log(`[WORKER] Starting VisaFlow Worker [workerId=${this.config.workerId}]`);

    const repo = new WorkerRepository();
    const credsService = new SecureProviderAccountService(repo);
    const sessionService = new AutomationSessionService(repo, this.config.workerId);
    const paymentHandoffService = new PaymentHandoffService(repo);
    const contextLoader = new ProviderContextLoaderService(repo);
    const adapterRegistry = new ProviderAdapterRegistryService();

    const vfsConfig = createVfsConfig({
      headless: this.config.vfsHeadless,
      navigationTimeoutMs: this.config.vfsNavTimeoutMs,
      actionTimeoutMs: this.config.vfsActionTimeoutMs,
      allowedOrigins: this.config.vfsAllowedOrigins,
      sessionTtlMinutes: this.config.sessionTtlMinutes,
    });

    this.sessionManager = new VfsBrowserSessionManager(vfsConfig, this.config.workerId);
    const vfsAdapter = new VfsProviderAdapter(this.sessionManager, credsService, vfsConfig);

    adapterRegistry.register(ProviderCode.VFS, vfsAdapter);

    this.availabilityWorker = new AvailabilityWorker(
      this.config,
      repo,
      contextLoader,
      adapterRegistry,
      sessionService,
    );
    this.bookingWorker = new BookingWorker(
      this.config,
      repo,
      contextLoader,
      adapterRegistry,
      sessionService,
      paymentHandoffService,
    );
    this.sessionResumeWorker = new SessionResumeWorker(
      this.config,
      repo,
      contextLoader,
      adapterRegistry,
      sessionService,
    );

    this.availabilityWorker.start();
    this.bookingWorker.start();
    this.sessionResumeWorker.start();

    console.log('[WORKER] BullMQ workers (availability-check, booking-execution, session-resume) active.');
  }

  async shutdown(): Promise<void> {
    console.log('[WORKER] Shutting down workers and browser sessions...');
    await this.availabilityWorker?.close();
    await this.bookingWorker?.close();
    await this.sessionResumeWorker?.close();
    await this.sessionManager?.closeAll();
    console.log('[WORKER] Clean shutdown complete.');
  }
}

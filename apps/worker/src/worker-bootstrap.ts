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
import { GracefulShutdownService } from './reliability/graceful-shutdown.service.js';
import { SessionRecoveryService } from './reliability/session-recovery.service.js';
import { ExpiredSessionCleanupJob } from './jobs/maintenance/expired-session-cleanup.job.js';
import { PaymentExpiryJob } from './jobs/maintenance/payment-expiry.job.js';
import { StuckCaseRecoveryJob } from './jobs/maintenance/stuck-case-recovery.job.js';
import { LiveVisualMonitorService } from './monitoring/live-visual-monitor.service.js';
import { workerLogger } from './observability/safe-logger.js';

export class WorkerBootstrap {
  private config: WorkerConfig;
  private availabilityWorker?: AvailabilityWorker;
  private bookingWorker?: BookingWorker;
  private sessionResumeWorker?: SessionResumeWorker;
  private sessionManager?: VfsBrowserSessionManager;
  private visualMonitorService?: LiveVisualMonitorService;
  private shutdownService: GracefulShutdownService;
  private maintenanceInterval?: NodeJS.Timeout;

  constructor(configOverride?: Partial<WorkerConfig>) {
    this.config = { ...loadWorkerConfig(), ...configOverride };
    this.shutdownService = new GracefulShutdownService(this.config.workerShutdownTimeoutMs || 10000);
  }

  async start(): Promise<void> {
    workerLogger.info(`Starting VisaFlow Worker [workerId=${this.config.workerId}]`);

    const repo = new WorkerRepository();
    const credsService = new SecureProviderAccountService(repo);
    const sessionService = new AutomationSessionService(repo, this.config.workerId);
    const paymentHandoffService = new PaymentHandoffService(repo);
    const contextLoader = new ProviderContextLoaderService(repo);
    const adapterRegistry = new ProviderAdapterRegistryService();

    // 1. Startup Orphan & Session Recovery
    const sessionRecovery = new SessionRecoveryService(this.config.workerId);
    await sessionRecovery.recoverStartupSessions();

    const proxyConfig = this.config.vfsProxyServer
      ? {
          server: this.config.vfsProxyServer,
          ...(this.config.vfsProxyUsername ? { username: this.config.vfsProxyUsername } : {}),
          ...(this.config.vfsProxyPassword ? { password: this.config.vfsProxyPassword } : {}),
          ...(this.config.vfsProxyBypass ? { bypass: this.config.vfsProxyBypass } : {}),
        }
      : undefined;

    if (proxyConfig) {
      workerLogger.info(`[WorkerBootstrap] VFS Proxy ACTIVE: ${proxyConfig.server}`);
    } else {
      workerLogger.warn(`[WorkerBootstrap] VFS Proxy NOT configured, running direct connection`);
    }

    const vfsConfig = createVfsConfig({
      headless: this.config.vfsHeadless,
      navigationTimeoutMs: this.config.vfsNavTimeoutMs,
      actionTimeoutMs: this.config.vfsActionTimeoutMs,
      allowedOrigins: this.config.vfsAllowedOrigins,
      sessionTtlMinutes: this.config.sessionTtlMinutes,
      ...(proxyConfig ? { proxy: proxyConfig } : {}),
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

    // Initialize passive live visual monitor (sidecar only)
    this.visualMonitorService = new LiveVisualMonitorService(this.config, this.sessionManager);

    // Register resources with GracefulShutdownService
    this.shutdownService.register('visual-monitor', () => this.visualMonitorService?.close() ?? Promise.resolve());
    this.shutdownService.register('availability-worker', () => this.availabilityWorker?.close() ?? Promise.resolve());
    this.shutdownService.register('booking-worker', () => this.bookingWorker?.close() ?? Promise.resolve());
    this.shutdownService.register('session-resume-worker', () => this.sessionResumeWorker?.close() ?? Promise.resolve());
    this.shutdownService.register('browser-sessions', () => this.sessionManager?.closeAll() ?? Promise.resolve());

    this.availabilityWorker.start();
    this.bookingWorker.start();
    this.sessionResumeWorker.start();
    await this.visualMonitorService.start();

    // 2. Setup periodic maintenance cycle (every 60s)
    const cleanupJob = new ExpiredSessionCleanupJob();
    const paymentExpiryJob = new PaymentExpiryJob();
    const stuckCaseJob = new StuckCaseRecoveryJob();

    this.maintenanceInterval = setInterval(async () => {
      try {
        await cleanupJob.runCleanup();
        await paymentExpiryJob.runPaymentExpiryCheck();
        await stuckCaseJob.runRecoveryCycle();
      } catch (err) {
        workerLogger.error('Error running worker maintenance jobs:', err);
      }
    }, 60000);

    workerLogger.info('BullMQ workers and maintenance jobs active.');
  }

  async shutdown(signal = 'SIGTERM'): Promise<void> {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }
    await this.shutdownService.shutdown(signal);
  }
}

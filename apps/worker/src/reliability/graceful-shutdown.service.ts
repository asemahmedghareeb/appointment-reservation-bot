import { workerLogger } from '../observability/safe-logger.js';

export interface ClosableResource {
  name: string;
  close: () => Promise<void>;
}

export class GracefulShutdownService {
  private readonly resources: ClosableResource[] = [];
  private isShuttingDown = false;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 10000) {
    this.timeoutMs = timeoutMs;
  }

  register(name: string, closeFn: () => Promise<void>): void {
    this.resources.push({ name, close: closeFn });
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      workerLogger.warn(`Shutdown already in progress. Ignoring signal ${signal}.`);
      return;
    }

    this.isShuttingDown = true;
    workerLogger.info(`Graceful shutdown initiated by ${signal}. Timeout: ${this.timeoutMs}ms.`);

    const shutdownPromise = async () => {
      for (const res of this.resources) {
        try {
          workerLogger.info(`Closing resource: ${res.name}...`);
          await res.close();
          workerLogger.info(`Resource closed successfully: ${res.name}.`);
        } catch (err) {
          workerLogger.error(`Error closing resource ${res.name}:`, err);
        }
      }
    };

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Graceful shutdown timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });

    try {
      await Promise.race([shutdownPromise(), timeoutPromise]);
      workerLogger.info('All resources terminated cleanly. Exiting.');
    } catch (err) {
      workerLogger.error('Shutdown forced due to error or deadline expiration:', err);
    }
  }

  get isInProgress(): boolean {
    return this.isShuttingDown;
  }
}

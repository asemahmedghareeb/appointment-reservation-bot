import { WorkerBootstrap } from './worker-bootstrap.js';

async function bootstrap() {
  console.log('Starting VisaFlow worker with LiveVisualMonitor...');
  const worker = new WorkerBootstrap();
  await worker.start();

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down worker cleanly...`);
    await worker.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('Failed to initialize VisaFlow worker:', err);
  process.exit(1);
});


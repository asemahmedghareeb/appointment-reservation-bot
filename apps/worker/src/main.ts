import { getEnv } from '@visaflow/config';

async function bootstrap() {
  console.log('Starting VisaFlow worker shell...');
  const env = getEnv();

  console.log(`VisaFlow worker shell initialized successfully. [NODE_ENV=${env.NODE_ENV}]`);
  console.log('Worker standing by for future phase job queue consumers.');

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down worker shell cleanly...`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep worker alive in standby
  const interval = setInterval(() => {
    // idle heartbeat
  }, 1000 * 60);

  interval.unref();
}

bootstrap().catch((err) => {
  console.error('Failed to initialize VisaFlow worker shell:', err);
  process.exit(1);
});

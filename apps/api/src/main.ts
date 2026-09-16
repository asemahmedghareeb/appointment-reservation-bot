import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { getEnv } from '@visaflow/config';
import { globalValidationPipe } from './common/pipes/validation.pipe.js';
import { DomainErrorFilter } from './common/errors/domain-error.filter.js';

async function bootstrap() {
  const env = getEnv();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow localhost, 127.0.0.1, [::1], and any dev origin
      if (
        !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$/.test(origin) ||
        env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-user-id',
      'X-Requested-With',
      'Range',
      'Origin',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });

  app.enableShutdownHooks();
  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new DomainErrorFilter());

  const port = env.API_PORT;
  await app.listen(port);
  console.log(`VisaFlow API running on http://localhost:${port} [NODE_ENV=${env.NODE_ENV}]`);
}

bootstrap().catch((err) => {
  console.error('Failed to start VisaFlow API:', err);
  process.exit(1);
});

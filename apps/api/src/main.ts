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
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      ...(env.NODE_ENV === 'production' && process.env.CORS_ORIGIN
        ? [process.env.CORS_ORIGIN]
        : []),
    ],
    credentials: true,
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

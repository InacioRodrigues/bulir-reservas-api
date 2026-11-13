import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { apiReference } from '@scalar/nestjs-api-reference';
import { openApiSpec } from './config/openapi.definition';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const prefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', [
    'http://localhost:3000',
  ]);

  // Set Pino Logger as global NestJS logger
  app.useLogger(app.get(Logger));

  // Security Middlewares
  app.use(
    helmet({
      contentSecurityPolicy: false, // Turn off CSP for Scalar reference page styling
    }),
  );
  app.use(cookieParser());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  // Global Prefix
  app.setGlobalPrefix(prefix);

  // Enable Graceful Shutdown hooks
  app.enableShutdownHooks();

  // Mount Scalar API documentation
  app.use(
    '/reference',
    apiReference({
      spec: {
        content: openApiSpec,
      },
    }),
  );

  await app.listen(port);

  // Retrieve logger instance for boot output
  const logger = app.get(Logger);
  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${prefix}`,
  );
  logger.log(`📄 Scalar API Documentation: http://localhost:${port}/reference`);
}

bootstrap().catch((err) => {
  console.error('Application failed to start:', err);
  process.exit(1);
});

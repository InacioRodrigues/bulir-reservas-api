import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { DOCS_PATH } from './config/security-headers';
import { configureHttpApp } from './bootstrap/configure-http-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Parsers registados à mão em `configureHttpApp`, por ordem e com limite.
    bodyParser: false,
  });

  const { port, prefix, appUrl } = configureHttpApp(app);

  await app.listen(port);

  // Retrieve logger instance for boot output
  const logger = app.get(Logger);
  logger.log(`🚀 Application is running on: ${appUrl}/${prefix}`);
  logger.log(`📄 Scalar API Documentation: ${appUrl}${DOCS_PATH}`);
}

bootstrap().catch((err) => {
  console.error('Application failed to start:', err);
  process.exit(1);
});

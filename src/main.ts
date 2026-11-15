import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import compression from 'compression';
import { apiReference } from '@scalar/nestjs-api-reference';
import { buildOpenApiSpec } from './config/openapi.definition';
import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors.config';
import {
  DOCS_PATH,
  OPENAPI_JSON_PATH,
  SCALAR_CDN,
  securityHeaders,
} from './config/security-headers';
import { assignRequestIds } from './common/http/request-ids';
import { requireJsonBody } from './common/http/require-json-body';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Parsers registados à mão (abaixo), por ordem e com limite explícito.
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const prefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const bodyLimit = configService.get<string>('app.bodyLimit', '16kb');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  const trustProxy = configService.get<number>('app.trustProxy', 0);
  const appUrl = configService.get<string>(
    'app.appUrl',
    `http://localhost:${port}`,
  );
  const openApiSpec = buildOpenApiSpec(appUrl);

  // Atrás de um proxy (Render, Railway, nginx) o IP do socket é o do proxy.
  // Confiar em N saltos faz `req.ip` vir de X-Forwarded-For — sem isto, todos
  // os clientes partilhariam o mesmo contador de rate limit. Nunca `true`:
  // um cliente poderia forjar o header e escolher o próprio IP.
  app.set('trust proxy', trustProxy);

  // Set Pino Logger as global NestJS logger
  app.useLogger(app.get(Logger));

  // Helmet: CSP estrita para a API e CSP com nonce para a documentação.
  app.use(securityHeaders());

  // Ids do pedido antes do parser: erros de corpo também levam correlationId.
  app.use((req: Request, res: Response, next: NextFunction) => {
    assignRequestIds(req, res);
    next();
  });

  // CORS antes do parser: até um 413 tem de ser legível pela app web.
  app.enableCors(buildCorsOptions(corsOrigins));
  app.use(compression());

  // A API só aceita JSON. Limite pequeno: o maior corpo legítimo (um serviço
  // com descrição de 1000 caracteres) tem poucos KB; acima disso → 413.
  // Sem parser de urlencoded/multipart: menos superfície de ataque.
  app.useBodyParser('json', { limit: bodyLimit });
  app.use(requireJsonBody);

  // Global Prefix
  app.setGlobalPrefix(prefix);

  // Enable Graceful Shutdown hooks
  app.enableShutdownHooks();

  // Documento OpenAPI em bruto (geração de clientes, importação no Postman).
  app.use(OPENAPI_JSON_PATH, (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  // Documentação interativa (Scalar). Renderizada por pedido para incluir o
  // nonce da CSP gerado em `securityHeaders()`.
  app.use(DOCS_PATH, (req: Request, res: Response) => {
    apiReference({
      content: openApiSpec,
      cdn: SCALAR_CDN,
      nonce: res.locals.cspNonce as string,
    })(req, res);
  });

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

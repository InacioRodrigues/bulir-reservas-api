import { randomUUID } from 'node:crypto';
import { Params } from 'nestjs-pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Caminhos apagados de qualquer linha de log (defesa em profundidade: os
 * serializers abaixo já não incluem headers nem corpos). Cobre credenciais
 * em headers e campos sensíveis em objetos registados à mão, até 2 níveis
 * (ex.: `logger.info({ dto })` → `dto.password`).
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...[
    'password',
    'passwordHash',
    'accessToken',
    'refreshToken',
    'token',
    'authorization',
  ].flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
];

export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    // Os ids já foram atribuídos (e saneados) antes do parser do corpo.
    genReqId: (req: any) => req.requestId ?? randomUUID(),
    transport: !isProduction
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            levelFirst: true,
            translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
          },
        }
      : undefined,
    customProps: (req: any) => ({
      requestId: req.requestId ?? req.id,
      correlationId: req.correlationId,
    }),
    serializers: {
      // Só o necessário para depurar: sem headers (Authorization), sem corpo
      // (passwords) e sem query string (pode conter termos de pesquisa).
      req: (req: any) => ({
        id: req.id,
        method: req.method,
        url: typeof req.url === 'string' ? req.url.split('?')[0] : req.url,
        // `req.ip` respeita TRUST_PROXY; o X-Forwarded-For cru é forjável.
        ip: req.raw?.ip ?? req.remoteAddress,
        userAgent: req.headers?.['user-agent'],
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
      }),
      err: (err: any) => ({
        type: err.type,
        message: err.message,
        // Stack só fora de produção: em produção basta o correlationId.
        stack: isProduction ? undefined : err.stack,
      }),
    },
    autoLogging: {
      ignore: (req) => req.url?.includes('/health') || false,
    },
    quietReqLogger: true,
  },
};

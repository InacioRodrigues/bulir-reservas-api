import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Por omissão (desenvolvimento): app web (Vite, :5173) e Expo em modo web
 * (Metro, :8081). Em produção define-se `CORS_ORIGINS` com os domínios reais.
 */
export const DEFAULT_CORS_ORIGINS =
  'http://localhost:5173,http://localhost:8081';

/** Valor especial de `CORS_ORIGINS` que aceita qualquer origem. */
export const ANY_ORIGIN = '*';

/**
 * Normaliza a lista de `CORS_ORIGINS` (separada por vírgulas): remove espaços,
 * entradas vazias e a barra final — o browser envia `Origin` sem ela.
 */
export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

/**
 * CORS é uma regra *do browser*: só restringe páginas web (a app React e o
 * Expo em modo web). A app mobile nativa e o curl não enviam `Origin` e não
 * são afetados — por isso pedidos sem `Origin` passam sempre.
 *
 * - Origem fora da lista → não enviamos `Access-Control-Allow-Origin` e é o
 *   browser que bloqueia a leitura da resposta (não lançamos erro → não há 500).
 * - `credentials: false`: a sessão viaja no header `Authorization`, não em
 *   cookies, por isso o browser nunca precisa de enviar credenciais ambientes.
 * - `maxAge`: o browser guarda o resultado do *preflight* (OPTIONS) durante
 *   10 minutos, poupando um pedido extra antes de cada PATCH/DELETE/POST JSON.
 */
export function buildCorsOptions(allowedOrigins: string[]): CorsOptions {
  const allowAny = allowedOrigins.includes(ANY_ORIGIN);
  const allowed = new Set(allowedOrigins);

  return {
    origin: (origin, callback) => {
      callback(null, !origin || allowAny || allowed.has(origin));
    },
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Request-Id',
      'X-Correlation-Id',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'X-Correlation-Id',
      'Retry-After',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 600,
  };
}

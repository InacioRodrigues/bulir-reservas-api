import { z } from 'zod';
import {
  ANY_ORIGIN,
  DEFAULT_CORS_ORIGINS,
  parseCorsOrigins,
} from './cors.config';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_PREFIX: z.string().default('api/v1'),
  // Origens web autorizadas (separadas por vírgulas) ou "*". Cada entrada tem
  // de ser uma origem (esquema + host [+ porta]), sem caminho.
  CORS_ORIGINS: z
    .string()
    .default(DEFAULT_CORS_ORIGINS)
    .transform(parseCorsOrigins)
    .refine(
      (origins) =>
        origins.length > 0 &&
        origins.every(
          (o) => o === ANY_ORIGIN || /^https?:\/\/[^/\s]+$/.test(o),
        ),
      'CORS_ORIGINS deve listar origens como https://app.exemplo.com ou "*"',
    ),

  // Tamanho máximo do corpo JSON (sintaxe do `bytes`: 16kb, 1mb, ...).
  BODY_LIMIT: z
    .string()
    .regex(/^\d+(b|kb|mb)$/i, 'BODY_LIMIT deve ser do tipo 16kb ou 1mb')
    .default('16kb'),

  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),
  // Pedidos/minuto por IP em POST /auth/login e /auth/register.
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(5),

  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  DATABASE_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

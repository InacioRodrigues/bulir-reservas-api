import { registerAs } from '@nestjs/config';
import { DEFAULT_CORS_ORIGINS, parseCorsOrigins } from './cors.config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // URL público desta instância (servidor na spec OpenAPI). No Render, sem
  // APP_URL definido, usa o URL que a plataforma injeta.
  appUrl:
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || '3000'}`,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  trustProxy: parseInt(process.env.TRUST_PROXY || '0', 10),
  bodyLimit: process.env.BODY_LIMIT || '16kb',
  corsOrigins: parseCorsOrigins(
    process.env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS,
  ),
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
}));

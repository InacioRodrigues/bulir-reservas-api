import { registerAs } from '@nestjs/config';
import { DEFAULT_CORS_ORIGINS, parseCorsOrigins } from './cors.config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  bodyLimit: process.env.BODY_LIMIT || '16kb',
  corsOrigins: parseCorsOrigins(
    process.env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS,
  ),
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
}));

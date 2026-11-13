import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';

export const configurations = [appConfig, databaseConfig, jwtConfig];
export { validateEnv } from './env.validation';
export type { Env } from './env.validation';

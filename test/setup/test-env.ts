/**
 * Ambiente de cada ficheiro de testes de integração/e2e (`setupFiles`):
 * corre antes de qualquer import da aplicação, por isso o `PrismaService`, o
 * `ConfigModule` e o logger já leem estes valores.
 */
import { resolveTestDatabaseUrl } from './test-database';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.LOG_LEVEL ??= 'silent';
process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_8_chars';
process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_8_chars';

// Os testes fazem dezenas de logins, reservas e carregamentos por minuto a
// partir do mesmo IP/utilizador: com os limites reais (5 e 10/min) falhariam
// com 429. O próprio rate limiting tem um teste dedicado que baixa o limite.
process.env.THROTTLE_LIMIT = '100000';
process.env.AUTH_THROTTLE_LIMIT = '100000';
process.env.MONEY_THROTTLE_LIMIT = '100000';

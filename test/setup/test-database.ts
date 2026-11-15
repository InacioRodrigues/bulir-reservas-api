/**
 * BD dos testes de integração e e2e.
 *
 * Os testes nunca correm contra a BD de desenvolvimento: o URL é o de
 * `TEST_DATABASE_URL` ou, na falta dele, o de `DATABASE_URL` com o nome da BD
 * terminado em `_test` (`bulir_reservas` → `bulir_reservas_test`), no mesmo
 * servidor PostgreSQL. Qualquer operação destrutiva exige esse sufixo.
 */
import { config as loadDotenv } from 'dotenv';

const TEST_DB_SUFFIX = '_test';
const SAFE_DB_NAME = /^[a-z0-9_]+$/;

export function resolveTestDatabaseUrl(): string {
  loadDotenv({ quiet: true });
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'Defina TEST_DATABASE_URL ou DATABASE_URL para correr os testes contra o PostgreSQL',
    );
  }

  const url = new URL(base);
  const name = databaseName(url);
  if (!name.endsWith(TEST_DB_SUFFIX)) {
    url.pathname = `/${name}${TEST_DB_SUFFIX}`;
  }
  assertTestDatabase(url);
  return url.toString();
}

export function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, ''));
}

/** Trava de segurança antes de criar, migrar ou limpar a BD. */
export function assertTestDatabase(url: URL): void {
  const name = databaseName(url);
  if (!SAFE_DB_NAME.test(name) || !name.endsWith(TEST_DB_SUFFIX)) {
    throw new Error(
      `Recusado: "${name}" não é uma BD de testes (o nome tem de terminar em ${TEST_DB_SUFFIX})`,
    );
  }
}

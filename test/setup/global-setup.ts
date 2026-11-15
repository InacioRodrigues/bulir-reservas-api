/**
 * Corre uma vez antes dos testes de integração/e2e: cria a BD de testes se
 * não existir, aplica as migrações (as mesmas de produção, com os CHECKs) e
 * esvazia as tabelas, para cada execução partir de um estado conhecido.
 */
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import {
  assertTestDatabase,
  databaseName,
  resolveTestDatabaseUrl,
} from './test-database';

export default async function globalSetup(): Promise<void> {
  const testUrl = new URL(resolveTestDatabaseUrl());
  assertTestDatabase(testUrl);
  const name = databaseName(testUrl);

  await createDatabaseIfMissing(testUrl, name);

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: 'pipe',
  });

  await truncateAllTables(testUrl);
}

async function createDatabaseIfMissing(testUrl: URL, name: string) {
  // Liga-se à BD de manutenção `postgres` do mesmo servidor.
  const adminUrl = new URL(testUrl.toString());
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (!rowCount) {
      // Identificadores não aceitam parâmetros; o nome foi validado por
      // `assertTestDatabase` (só [a-z0-9_]).
      await admin.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.end();
  }
}

async function truncateAllTables(testUrl: URL) {
  const client = new Client({ connectionString: testUrl.toString() });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length > 0) {
      const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
      await client.query(`TRUNCATE TABLE ${tables} CASCADE`);
    }
  } finally {
    await client.end();
  }
}

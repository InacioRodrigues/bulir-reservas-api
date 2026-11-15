/**
 * Seed de demonstração: 2 clientes (um com saldo) e 2 prestadores com serviços.
 *
 * Dois modos (`SEED_MODE`):
 * - `reset` (omissão fora de produção): apaga **todos** os dados e recria a
 *   demonstração. Recusado sempre que NODE_ENV=production.
 * - `ensure` (omissão em produção): não apaga nada. Cria as contas de
 *   demonstração só se nenhuma delas existir; se já existirem, não faz nada.
 *   É idempotente, por isso pode correr em cada arranque do contentor
 *   (`SEED_DEMO_DATA=true`) sem tocar em dados reais nem duplicar contas.
 *
 * O saldo inicial do cliente entra pelo ledger (movimento TOP_UP), para que a
 * invariante SUM(wallet_transactions.amount) = users.balance se mantenha.
 */
import 'dotenv/config';
import {
  Prisma,
  PrismaClient,
  UserRole,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const DEMO_PASSWORD = 'Senha@123';

const DEMO_ACCOUNTS = [
  { email: 'ana.cliente@bulir.demo', nif: '004512345LA041' },
  { email: 'bruno.cliente@bulir.demo', nif: '006798765LA042' },
  { email: 'carla.prestadora@bulir.demo', nif: '5417001234' },
  { email: 'daniel.prestador@bulir.demo', nif: '5417005678' },
];

type SeedMode = 'reset' | 'ensure';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function resolveMode(): SeedMode {
  const isProduction = process.env.NODE_ENV === 'production';
  const mode = process.env.SEED_MODE ?? (isProduction ? 'ensure' : 'reset');

  if (mode !== 'reset' && mode !== 'ensure') {
    throw new Error(`SEED_MODE inválido: "${mode}" (use reset ou ensure).`);
  }
  if (mode === 'reset' && isProduction) {
    throw new Error(
      'SEED_MODE=reset apaga todos os dados e está bloqueado em produção (use ensure).',
    );
  }
  return mode;
}

async function main() {
  const mode = resolveMode();
  console.log(`A preparar dados de demonstração (modo ${mode})...`);
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const created = await prisma.$transaction(async (tx) => {
    if (mode === 'reset') {
      // Ordem inversa das FKs (todas com ON DELETE RESTRICT).
      await tx.walletTransaction.deleteMany();
      await tx.booking.deleteMany();
      await tx.service.deleteMany();
      await tx.refreshToken.deleteMany();
      await tx.user.deleteMany();
    } else {
      const existing = await tx.user.count({
        where: {
          OR: [
            { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } },
            { nif: { in: DEMO_ACCOUNTS.map((a) => a.nif) } },
          ],
        },
      });
      if (existing > 0) return false;
    }

    await createDemoData(tx, passwordHash);
    return true;
  });

  if (!created) {
    console.log('Contas de demonstração já existem: nada a fazer.');
    return;
  }
  printCredentials();
}

/** Cria as 4 contas de demonstração e os serviços dos prestadores. */
async function createDemoData(
  tx: Prisma.TransactionClient,
  passwordHash: string,
) {
  // ─── Clientes ────────────────────────────────────────────────────────────
  const ana = await tx.user.create({
    data: {
      fullName: 'Ana Paula Domingos',
      nif: '004512345LA041',
      email: 'ana.cliente@bulir.demo',
      passwordHash,
      role: UserRole.CLIENT,
      balance: '50000.00',
    },
  });
  await tx.walletTransaction.create({
    data: {
      userId: ana.id,
      type: WalletTransactionType.TOP_UP,
      amount: '50000.00',
      balanceAfter: '50000.00',
    },
  });

  await tx.user.create({
    data: {
      fullName: 'Bruno Miguel Cassoma',
      nif: '006798765LA042',
      email: 'bruno.cliente@bulir.demo',
      passwordHash,
      role: UserRole.CLIENT,
    },
  });

  // ─── Prestadores e serviços ─────────────────────────────────────────────
  await tx.user.create({
    data: {
      fullName: 'Carla Sofia Neto',
      nif: '5417001234',
      email: 'carla.prestadora@bulir.demo',
      passwordHash,
      role: UserRole.PROVIDER,
      services: {
        create: [
          {
            name: 'Corte de cabelo',
            description: 'Corte masculino ou feminino com lavagem incluída.',
            price: '5000.00',
          },
          {
            name: 'Manicure e pedicure',
            description: 'Tratamento completo de mãos e pés, com verniz.',
            price: '7500.00',
          },
          {
            name: 'Maquilhagem para eventos',
            description:
              'Maquilhagem profissional para casamentos e cerimónias.',
            price: '15000.00',
          },
        ],
      },
    },
  });

  await tx.user.create({
    data: {
      fullName: 'Daniel José Kiala',
      nif: '5417005678',
      email: 'daniel.prestador@bulir.demo',
      passwordHash,
      role: UserRole.PROVIDER,
      services: {
        create: [
          {
            name: 'Reparação de computadores',
            description:
              'Diagnóstico e reparação de portáteis e computadores de secretária.',
            price: '12000.00',
          },
          {
            name: 'Instalação de rede Wi-Fi',
            description:
              'Instalação e configuração de router e pontos de acesso em casa.',
            price: '25000.00',
          },
        ],
      },
    },
  });
}

function printCredentials() {
  console.log(
    '\nSeed concluído. Credenciais (password comum: %s)',
    DEMO_PASSWORD,
  );
  console.log(
    '  CLIENT   ana.cliente@bulir.demo        NIF 004512345LA041  saldo 50000.00',
  );
  console.log(
    '  CLIENT   bruno.cliente@bulir.demo      NIF 006798765LA042  saldo 0.00',
  );
  console.log(
    '  PROVIDER carla.prestadora@bulir.demo   NIF 5417001234      3 serviços',
  );
  console.log(
    '  PROVIDER daniel.prestador@bulir.demo   NIF 5417005678      2 serviços',
  );
}

main()
  .catch((error) => {
    // Dois arranques em simultâneo em modo ensure: o segundo esbarra no UNIQUE
    // de e-mail/NIF e a transação é desfeita — as contas já existem.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.log('Contas de demonstração já existem: nada a fazer.');
      return;
    }
    console.error('Seed falhou:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

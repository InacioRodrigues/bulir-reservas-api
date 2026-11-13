/**
 * Seed de demonstração: 2 clientes (um com saldo) e 2 prestadores com serviços.
 *
 * - Apaga e recria os dados → nunca correr contra produção com dados reais
 *   (bloqueado quando NODE_ENV=production, salvo SEED_ALLOW_PRODUCTION=true).
 * - O saldo inicial do cliente entra pelo ledger (movimento TOP_UP), para que a
 *   invariante SUM(wallet_transactions.amount) = users.balance se mantenha.
 */
import 'dotenv/config';
import { PrismaClient, UserRole, WalletTransactionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const DEMO_PASSWORD = 'Senha@123';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SEED_ALLOW_PRODUCTION !== 'true'
  ) {
    throw new Error(
      'Seed bloqueado em produção (defina SEED_ALLOW_PRODUCTION=true para forçar).',
    );
  }

  console.log('A preparar dados de demonstração...');
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  await prisma.$transaction(async (tx) => {
    // Ordem inversa das FKs (todas com ON DELETE RESTRICT).
    await tx.walletTransaction.deleteMany();
    await tx.booking.deleteMany();
    await tx.service.deleteMany();
    await tx.refreshToken.deleteMany();
    await tx.user.deleteMany();

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
  });

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
    console.error('Seed falhou:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

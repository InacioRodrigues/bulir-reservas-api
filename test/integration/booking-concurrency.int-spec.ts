/**
 * Concorrência contra um PostgreSQL real: a BD de testes (`*_test`), criada e
 * migrada por `test/setup/global-setup.ts` — nunca a de desenvolvimento.
 *
 * Os testes unitários provam as regras; estes provam que as garantias vêm da
 * BD (UPDATE condicional, locks de linha, CHECK, UNIQUE) quando há pedidos
 * realmente paralelos, cada um na sua ligação do pool.
 *
 * Cria utilizadores próprios (e-mails/NIF aleatórios) e apaga-os no fim.
 */
import { randomBytes } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { PrismaUnitOfWork } from '@database/prisma-unit-of-work';
import { Actor } from '@common/types/actor';
import { PrismaServiceRepository } from '@modules/services/infrastructure/repositories/prisma-service.repository';
import { PrismaWalletRepository } from '@modules/wallet/infrastructure/repositories/prisma-wallet.repository';
import { PrismaBookingRepository } from '@modules/bookings/infrastructure/repositories/prisma-booking.repository';
import { BookingTransactionScope } from '@modules/bookings/domain/ports/booking-unit-of-work';
import { WalletTransactionScope } from '@modules/wallet/domain/ports/wallet-unit-of-work';
import { CreateBookingUseCase } from '@modules/bookings/application/use-cases/create-booking.use-case';
import { CancelBookingUseCase } from '@modules/bookings/application/use-cases/cancel-booking.use-case';
import { TopUpWalletUseCase } from '@modules/wallet/application/use-cases/top-up-wallet.use-case';

const prisma = new PrismaService();
const createdUserIds: string[] = [];

const createBooking = new CreateBookingUseCase(
  new PrismaServiceRepository(prisma),
  new PrismaUnitOfWork<BookingTransactionScope>(prisma, (tx) => ({
    bookings: new PrismaBookingRepository(tx),
    wallet: new PrismaWalletRepository(tx),
  })),
);
const cancelBooking = new CancelBookingUseCase(
  new PrismaBookingRepository(prisma),
  new PrismaUnitOfWork<BookingTransactionScope>(prisma, (tx) => ({
    bookings: new PrismaBookingRepository(tx),
    wallet: new PrismaWalletRepository(tx),
  })),
);
const topUp = new TopUpWalletUseCase(
  new PrismaUnitOfWork<WalletTransactionScope>(prisma, (tx) => ({
    wallet: new PrismaWalletRepository(tx),
  })),
);

async function createUser(role: UserRole): Promise<Actor> {
  const tag = randomBytes(5).toString('hex').toUpperCase();
  const user = await prisma.user.create({
    data: {
      fullName: `Teste ${role} ${tag}`,
      nif: `TST${tag}`,
      email: `concorrencia.${tag.toLowerCase()}@teste.local`,
      passwordHash: 'n/a',
      role,
    },
  });
  createdUserIds.push(user.id);
  return { id: user.id, role: user.role };
}

async function createService(provider: Actor, price: string) {
  return prisma.service.create({
    data: {
      name: 'Serviço de teste',
      description: 'Serviço criado pelo teste de concorrência',
      price,
      providerId: provider.id,
    },
  });
}

async function balanceOf(actor: Actor): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { balance: true },
  });
  return user.balance.toFixed(2);
}

/** Invariante do ledger: para cada utilizador, SUM(amount) = balance. */
async function expectLedgerMatchesBalances(actors: Actor[]) {
  const sums = await prisma.walletTransaction.groupBy({
    by: ['userId'],
    where: { userId: { in: actors.map((a) => a.id) } },
    _sum: { amount: true },
  });
  for (const actor of actors) {
    const sum = sums.find((s) => s.userId === actor.id)?._sum.amount;
    expect((sum ?? new Prisma.Decimal(0)).toFixed(2)).toBe(
      await balanceOf(actor),
    );
  }
}

const codesOf = (results: PromiseSettledResult<unknown>[]) =>
  results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => (r.reason as { code?: string }).code ?? String(r.reason));

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  const ids = createdUserIds;
  await prisma.walletTransaction.deleteMany({ where: { userId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.service.deleteMany({ where: { providerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('Reservas sob concorrência (PostgreSQL real)', () => {
  it('saldo para 3 reservas, 10 pedidos em paralelo → exatamente 3 sucessos e saldo final 0.00', async () => {
    const client = await createUser(UserRole.CLIENT);
    const provider = await createUser(UserRole.PROVIDER);
    const service = await createService(provider, '5000.00');
    await topUp.execute(client, { amount: '15000.00' });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        createBooking.execute(client, { serviceId: service.id }),
      ),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(codesOf(results)).toEqual(Array(7).fill('INSUFFICIENT_BALANCE'));
    expect(await balanceOf(client)).toBe('0.00');
    expect(await balanceOf(provider)).toBe('15000.00');
    expect(await prisma.booking.count({ where: { clientId: client.id } })).toBe(
      3,
    );
    // Nenhuma reserva órfã: as 7 recusadas foram revertidas por inteiro.
    expect(
      await prisma.walletTransaction.count({
        where: { userId: client.id, type: 'BOOKING_DEBIT' },
      }),
    ).toBe(3);
    await expectLedgerMatchesBalances([client, provider]);
  });

  it('10 cancelamentos em paralelo da mesma reserva → 1 sucesso, 9 × 409 e um só reembolso', async () => {
    const client = await createUser(UserRole.CLIENT);
    const provider = await createUser(UserRole.PROVIDER);
    const service = await createService(provider, '7500.00');
    await topUp.execute(client, { amount: '10000.00' });
    const booking = await createBooking.execute(client, {
      serviceId: service.id,
    });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        cancelBooking.execute(i % 2 ? provider : client, booking.id),
      ),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(codesOf(results)).toEqual(
      Array(9).fill('BOOKING_ALREADY_CANCELLED'),
    );
    expect(await balanceOf(client)).toBe('10000.00');
    expect(await balanceOf(provider)).toBe('0.00');
    expect(
      await prisma.walletTransaction.count({
        where: { bookingId: booking.id, type: 'REFUND_CREDIT' },
      }),
    ).toBe(1);
    await expectLedgerMatchesBalances([client, provider]);
  });

  it('20 carregamentos em paralelo: nenhum se perde e cada balanceAfter é único', async () => {
    const client = await createUser(UserRole.CLIENT);

    await Promise.all(
      Array.from({ length: 20 }, () =>
        topUp.execute(client, { amount: '100.00' }),
      ),
    );

    expect(await balanceOf(client)).toBe('2000.00');
    const entries = await prisma.walletTransaction.findMany({
      where: { userId: client.id },
      select: { balanceAfter: true },
    });
    // 100, 200, …, 2000: cada UPDATE viu o resultado do anterior (sem lost update).
    const after = entries
      .map((e) => Number(e.balanceAfter.toFixed(0)))
      .sort((a, b) => a - b);
    expect(after).toEqual(Array.from({ length: 20 }, (_, i) => (i + 1) * 100));
  });

  it('reservas e cancelamentos cruzados entre vários utilizadores: sem deadlocks nem saldos negativos', async () => {
    const clients = [
      await createUser(UserRole.CLIENT),
      await createUser(UserRole.CLIENT),
    ];
    const providers = [
      await createUser(UserRole.PROVIDER),
      await createUser(UserRole.PROVIDER),
    ];
    const services = [
      await createService(providers[0], '1000.00'),
      await createService(providers[1], '2500.00'),
    ];
    for (const client of clients) {
      await topUp.execute(client, { amount: '10000.00' });
    }
    // Algumas reservas prévias para poderem ser canceladas em paralelo.
    const existing = await Promise.all(
      clients.flatMap((client) =>
        services.map((service) =>
          createBooking.execute(client, { serviceId: service.id }),
        ),
      ),
    );

    const operations = [
      ...existing.map(
        (booking, i) => () =>
          cancelBooking.execute(
            i % 2
              ? clients.find((c) => c.id === booking.clientId)!
              : providers.find((p) => p.id === booking.providerId)!,
            booking.id,
          ),
      ),
      ...Array.from(
        { length: 16 },
        (_, i) => () =>
          createBooking.execute(clients[i % 2], {
            serviceId: services[Math.floor(i / 2) % 2].id,
          }),
      ),
      ...clients.map(
        (client) => () => topUp.execute(client, { amount: '500.00' }),
      ),
    ];

    const results = await Promise.allSettled(operations.map((op) => op()));

    // Só erros de negócio esperados — nunca deadlock (40P01) nem 500.
    const unexpected = codesOf(results).filter(
      (code) => code !== 'INSUFFICIENT_BALANCE',
    );
    expect(unexpected).toEqual([]);

    const all = [...clients, ...providers];
    for (const actor of all) {
      expect(Number(await balanceOf(actor))).toBeGreaterThanOrEqual(0);
    }
    await expectLedgerMatchesBalances(all);
    // Dinheiro não se cria nem se perde: total = 2 × 10 000 + 2 × 500.
    const total = await prisma.user.aggregate({
      where: { id: { in: all.map((a) => a.id) } },
      _sum: { balance: true },
    });
    expect(total._sum.balance?.toFixed(2)).toBe('21000.00');
  });
});

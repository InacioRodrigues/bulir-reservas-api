import { createBookingsTestKit } from '@test/fakes/bookings-test-kit';
import { walletTransactionsQuerySchema } from '../dto/wallet.dto';
import { ListWalletTransactionsUseCase } from './list-wallet-transactions.use-case';

describe('ListWalletTransactionsUseCase', () => {
  const setup = async () => {
    const kit = createBookingsTestKit();
    await kit.fund(kit.client, '10000.00');
    const service = await kit.seedService(kit.provider, { price: '2500.00' });
    const booking = await kit.createBooking.execute(kit.client, {
      serviceId: service.id,
    });
    await kit.cancelBooking.execute(kit.provider, booking.id);
    return {
      ...kit,
      booking,
      useCase: new ListWalletTransactionsUseCase(kit.wallet),
    };
  };

  it('devolve só os movimentos do próprio utilizador, mais recentes primeiro', async () => {
    const { useCase, client, booking } = await setup();

    const page = await useCase.execute(client, { page: 1, perPage: 20 });

    expect(page.total).toBe(3);
    expect(page.items.map((t) => [t.type, t.amount, t.balanceAfter])).toEqual([
      ['REFUND_CREDIT', '2500.00', '10000.00'],
      ['BOOKING_DEBIT', '-2500.00', '7500.00'],
      ['TOP_UP', '10000.00', '10000.00'],
    ]);
    expect(page.items[0].bookingId).toBe(booking.id);
    expect(page.items.every((t) => t.userId === client.id)).toBe(true);
  });

  it('o prestador vê os seus movimentos (crédito e débito do reembolso)', async () => {
    const { useCase, provider } = await setup();

    const page = await useCase.execute(provider, { page: 1, perPage: 20 });

    expect(page.items.map((t) => t.type)).toEqual([
      'REFUND_DEBIT',
      'BOOKING_CREDIT',
    ]);
  });

  it('pagina com total correto', async () => {
    const { useCase, client } = await setup();

    const page = await useCase.execute(client, { page: 2, perPage: 2 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].type).toBe('TOP_UP');
    expect(page.total).toBe(3);
  });

  it('a query só aceita page/perPage dentro dos limites', () => {
    expect(walletTransactionsQuerySchema.parse({})).toEqual({
      page: 1,
      perPage: 20,
    });
    expect(
      walletTransactionsQuerySchema.safeParse({ perPage: '101' }).success,
    ).toBe(false);
    // `userId` na query é ignorado: o extrato é sempre do utilizador do token.
    expect(
      walletTransactionsQuerySchema.parse({ userId: 'outro', page: '2' }),
    ).toEqual({ page: 2, perPage: 20 });
  });
});

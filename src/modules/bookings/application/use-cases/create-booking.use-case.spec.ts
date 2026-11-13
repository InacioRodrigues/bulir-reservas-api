import { randomUUID } from 'node:crypto';
import { createBookingsTestKit } from '@test/fakes/bookings-test-kit';
import { ServiceNotFoundError } from '@modules/services/domain/errors/service.errors';
import { DeleteServiceUseCase } from '@modules/services/application/use-cases/delete-service.use-case';
import { UpdateServiceUseCase } from '@modules/services/application/use-cases/update-service.use-case';
import { InsufficientBalanceError } from '@modules/wallet/domain/errors/wallet.errors';
import { ClientOnlyBookingError } from '../../domain/errors/booking.errors';

describe('CreateBookingUseCase', () => {
  it('reserva: debita o cliente, credita o prestador e regista os dois movimentos', async () => {
    const kit = createBookingsTestKit();
    const { client, provider, wallet, fund, seedService, createBooking } = kit;
    await fund(client, '12000.00');
    const service = await seedService(provider, { price: '5000.00' });

    const booking = await createBooking.execute(client, {
      serviceId: service.id,
    });

    expect(booking).toMatchObject({
      status: 'CONFIRMED',
      price: '5000.00',
      clientId: client.id,
      providerId: provider.id,
      serviceId: service.id,
      serviceName: service.name,
      clientName: 'Ana Paula Domingos',
      providerName: 'Carla Sofia Neto',
    });
    expect(wallet.balanceOf(client.id)).toBe('7000.00');
    expect(wallet.balanceOf(provider.id)).toBe('5000.00');

    const movements = wallet.store.ledger.filter(
      (t) => t.bookingId === booking.id,
    );
    expect(movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: client.id,
          type: 'BOOKING_DEBIT',
          amount: '-5000.00',
          balanceAfter: '7000.00',
        }),
        expect.objectContaining({
          userId: provider.id,
          type: 'BOOKING_CREDIT',
          amount: '5000.00',
          balanceAfter: '5000.00',
        }),
      ]),
    );
    kit.expectLedgerMatchesBalances();
  });

  it('saldo exatamente igual ao preço é suficiente (fica a 0.00)', async () => {
    const { client, wallet, fund, seedService, createBooking } =
      createBookingsTestKit();
    await fund(client, '5000.00');
    const service = await seedService(undefined, { price: '5000.00' });

    await createBooking.execute(client, { serviceId: service.id });

    expect(wallet.balanceOf(client.id)).toBe('0.00');
  });

  it('saldo insuficiente → 409 INSUFFICIENT_BALANCE e nada fica gravado (rollback)', async () => {
    const kit = createBookingsTestKit();
    const { client, provider, wallet, bookings, unitOfWork, fund } = kit;
    await fund(client, '4999.99');
    const service = await kit.seedService(provider, { price: '5000.00' });
    const ledgerBefore = wallet.store.ledger.length;

    const attempt = kit.createBooking.execute(client, {
      serviceId: service.id,
    });

    await expect(attempt).rejects.toBeInstanceOf(InsufficientBalanceError);
    await expect(attempt).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      status: 409,
    });
    expect(unitOfWork.rollbacks).toBe(1);
    expect(bookings.items).toHaveLength(0);
    expect(wallet.store.ledger).toHaveLength(ledgerBefore);
    expect(wallet.balanceOf(client.id)).toBe('4999.99');
    expect(wallet.balanceOf(provider.id)).toBe('0.00');
  });

  it('um prestador não pode reservar (403)', async () => {
    const { provider, otherProvider, seedService, createBooking, fund } =
      createBookingsTestKit();
    await fund(provider, '100000.00');
    const service = await seedService(otherProvider);

    await expect(
      createBooking.execute(provider, { serviceId: service.id }),
    ).rejects.toBeInstanceOf(ClientOnlyBookingError);
  });

  it('serviço inexistente → 404', async () => {
    const { client, createBooking } = createBookingsTestKit();

    await expect(
      createBooking.execute(client, { serviceId: randomUUID() }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  it('serviço eliminado → 404 e o saldo não é tocado', async () => {
    const kit = createBookingsTestKit();
    const { client, provider, wallet, fund, seedService, createBooking } = kit;
    await fund(client, '10000.00');
    const service = await seedService();
    await new DeleteServiceUseCase(kit.services).execute(provider, service.id);

    await expect(
      createBooking.execute(client, { serviceId: service.id }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
    expect(wallet.balanceOf(client.id)).toBe('10000.00');
  });

  it('snapshot: editar o serviço depois não altera a reserva', async () => {
    const kit = createBookingsTestKit();
    const { client, provider, fund, seedService, createBooking, bookings } =
      kit;
    await fund(client, '10000.00');
    const service = await seedService(provider, {
      name: 'Corte de cabelo',
      price: '5000.00',
    });
    const booking = await createBooking.execute(client, {
      serviceId: service.id,
    });

    await new UpdateServiceUseCase(kit.services).execute(provider, service.id, {
      name: 'Corte premium',
      price: '9000.00',
    });

    const stored = await bookings.findById(booking.id);
    expect(stored).toMatchObject({
      serviceName: 'Corte de cabelo',
      price: '5000.00',
    });
  });

  it('pedidos simultâneos: saldo para 3 reservas, 10 pedidos → exatamente 3 sucessos', async () => {
    const kit = createBookingsTestKit();
    const { client, provider, wallet, fund, seedService, createBooking } = kit;
    await fund(client, '15000.00');
    const service = await seedService(provider, { price: '5000.00' });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        createBooking.execute(client, { serviceId: service.id }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(7);
    rejected.forEach((r) =>
      expect(r.reason).toBeInstanceOf(InsufficientBalanceError),
    );
    expect(wallet.balanceOf(client.id)).toBe('0.00');
    expect(wallet.balanceOf(provider.id)).toBe('15000.00');
    expect(kit.bookings.items).toHaveLength(3);
    kit.expectLedgerMatchesBalances();
  });
});

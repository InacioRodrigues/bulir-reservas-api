import { randomUUID } from 'node:crypto';
import { createBookingsTestKit } from '@test/fakes/bookings-test-kit';
import { UpdateServiceUseCase } from '@modules/services/application/use-cases/update-service.use-case';
import {
  BookingAlreadyCancelledError,
  BookingNotFoundError,
  NotBookingParticipantError,
  ProviderInsufficientBalanceError,
} from '../../domain/errors/booking.errors';

describe('CancelBookingUseCase', () => {
  /** Cliente com 20 000.00, reserva de 5 000.00 já feita. */
  const setup = async () => {
    const kit = createBookingsTestKit();
    await kit.fund(kit.client, '20000.00');
    const service = await kit.seedService(kit.provider, { price: '5000.00' });
    const booking = await kit.createBooking.execute(kit.client, {
      serviceId: service.id,
    });
    return { ...kit, service, booking };
  };

  it('o cliente cancela: reembolso integral e movimentos REFUND_* no ledger', async () => {
    const kit = await setup();
    const { client, provider, wallet, booking } = kit;

    const cancelled = await kit.cancelBooking.execute(client, booking.id);

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(cancelled.cancelledByRole()).toBe('CLIENT');
    expect(wallet.balanceOf(client.id)).toBe('20000.00');
    expect(wallet.balanceOf(provider.id)).toBe('0.00');

    const refunds = wallet.store.ledger.filter(
      (t) => t.bookingId === booking.id && t.type.startsWith('REFUND'),
    );
    expect(refunds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: client.id,
          type: 'REFUND_CREDIT',
          amount: '5000.00',
          balanceAfter: '20000.00',
        }),
        expect.objectContaining({
          userId: provider.id,
          type: 'REFUND_DEBIT',
          amount: '-5000.00',
          balanceAfter: '0.00',
        }),
      ]),
    );
    kit.expectLedgerMatchesBalances();
  });

  it('o prestador do serviço também pode cancelar (cancelledBy = PROVIDER)', async () => {
    const { provider, cancelBooking, booking, wallet, client } = await setup();

    const cancelled = await cancelBooking.execute(provider, booking.id);

    expect(cancelled.cancelledByRole()).toBe('PROVIDER');
    expect(wallet.balanceOf(client.id)).toBe('20000.00');
  });

  it.each(['otherClient', 'otherProvider'] as const)(
    '%s (não participa) → 403 e nada muda',
    async (who) => {
      const kit = await setup();

      await expect(
        kit.cancelBooking.execute(kit[who], kit.booking.id),
      ).rejects.toBeInstanceOf(NotBookingParticipantError);
      expect(kit.bookings.items[0].status).toBe('CONFIRMED');
      expect(kit.wallet.balanceOf(kit.client.id)).toBe('15000.00');
    },
  );

  it('reserva inexistente → 404', async () => {
    const { client, cancelBooking } = await setup();

    await expect(
      cancelBooking.execute(client, randomUUID()),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it('cancelar duas vezes → 409 BOOKING_ALREADY_CANCELLED e um só reembolso', async () => {
    const { client, provider, cancelBooking, booking, wallet } = await setup();
    await cancelBooking.execute(client, booking.id);

    await expect(
      cancelBooking.execute(provider, booking.id),
    ).rejects.toMatchObject({ code: 'BOOKING_ALREADY_CANCELLED', status: 409 });
    expect(wallet.balanceOf(client.id)).toBe('20000.00');
  });

  it('cancelamentos simultâneos: só um vence, os outros recebem 409', async () => {
    const kit = await setup();
    const { client, provider, booking, wallet } = kit;

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        kit.cancelBooking.execute(i % 2 ? provider : client, booking.id),
      ),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .forEach((r) =>
        expect(r.reason).toBeInstanceOf(BookingAlreadyCancelledError),
      );
    expect(wallet.balanceOf(client.id)).toBe('20000.00');
    expect(wallet.balanceOf(provider.id)).toBe('0.00');
    expect(
      wallet.store.ledger.filter((t) => t.type === 'REFUND_CREDIT'),
    ).toHaveLength(1);
    kit.expectLedgerMatchesBalances();
  });

  it('reembolsa o preço pago, mesmo que o serviço tenha mudado de preço', async () => {
    const kit = await setup();
    await new UpdateServiceUseCase(kit.services).execute(
      kit.provider,
      kit.service.id,
      { price: '9999.00' },
    );

    await kit.cancelBooking.execute(kit.client, kit.booking.id);

    expect(kit.wallet.balanceOf(kit.client.id)).toBe('20000.00');
  });

  it('prestador sem saldo para devolver → 409 e a reserva continua CONFIRMED (rollback)', async () => {
    const kit = await setup();
    kit.wallet.setBalance(kit.provider.id, '4999.99');

    await expect(
      kit.cancelBooking.execute(kit.client, kit.booking.id),
    ).rejects.toBeInstanceOf(ProviderInsufficientBalanceError);
    expect(kit.bookings.items[0].status).toBe('CONFIRMED');
    expect(kit.wallet.balanceOf(kit.client.id)).toBe('15000.00');
    expect(kit.wallet.balanceOf(kit.provider.id)).toBe('4999.99');
  });
});

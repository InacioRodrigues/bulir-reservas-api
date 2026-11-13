import { randomUUID } from 'node:crypto';
import { createBookingsTestKit } from '@test/fakes/bookings-test-kit';
import {
  BookingNotFoundError,
  NotBookingParticipantError,
} from '../../domain/errors/booking.errors';
import { GetBookingUseCase } from './get-booking.use-case';

describe('GetBookingUseCase', () => {
  const setup = async () => {
    const kit = createBookingsTestKit();
    await kit.fund(kit.client, '5000.00');
    const service = await kit.seedService(kit.provider, { price: '5000.00' });
    const booking = await kit.createBooking.execute(kit.client, {
      serviceId: service.id,
    });
    return { ...kit, booking, useCase: new GetBookingUseCase(kit.bookings) };
  };

  it.each(['client', 'provider'] as const)(
    'o %s da reserva vê o detalhe',
    async (who) => {
      const kit = await setup();

      const booking = await kit.useCase.execute(kit[who], kit.booking.id);

      expect(booking).toMatchObject({
        id: kit.booking.id,
        clientName: 'Ana Paula Domingos',
        providerName: 'Carla Sofia Neto',
      });
    },
  );

  it.each(['otherClient', 'otherProvider'] as const)(
    '%s (não participa) → 403',
    async (who) => {
      const kit = await setup();

      await expect(
        kit.useCase.execute(kit[who], kit.booking.id),
      ).rejects.toBeInstanceOf(NotBookingParticipantError);
    },
  );

  it('inexistente → 404', async () => {
    const { useCase, client } = await setup();

    await expect(useCase.execute(client, randomUUID())).rejects.toBeInstanceOf(
      BookingNotFoundError,
    );
  });
});

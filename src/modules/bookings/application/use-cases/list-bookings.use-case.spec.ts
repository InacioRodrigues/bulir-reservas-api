import { createBookingsTestKit } from '@test/fakes/bookings-test-kit';
import { DeleteServiceUseCase } from '@modules/services/application/use-cases/delete-service.use-case';
import { listBookingsQuerySchema } from '../dto/booking.dto';
import { ListBookingsUseCase } from './list-bookings.use-case';

describe('ListBookingsUseCase', () => {
  /**
   * Ana: 2 reservas com a Carla (uma cancelada) + 1 com o Daniel.
   * Bruno: 1 reserva com a Carla.
   */
  const setup = async () => {
    const kit = createBookingsTestKit();
    const { client, otherClient, provider, otherProvider } = kit;
    await kit.fund(client, '50000.00');
    await kit.fund(otherClient, '50000.00');
    const carla = await kit.seedService(provider, { price: '1000.00' });
    const daniel = await kit.seedService(otherProvider, { price: '2000.00' });

    const book = (actor: typeof client, serviceId: string) =>
      kit.createBooking.execute(actor, { serviceId });
    const first = await book(client, carla.id);
    await book(client, daniel.id);
    await book(otherClient, carla.id);
    const last = await book(client, carla.id);
    await kit.cancelBooking.execute(client, first.id);

    return {
      ...kit,
      carla,
      first,
      last,
      useCase: new ListBookingsUseCase(kit.bookings),
    };
  };

  const query = (extra: Record<string, unknown> = {}) =>
    listBookingsQuerySchema.parse(extra);

  it('o cliente vê só as suas reservas, mais recentes primeiro', async () => {
    const { useCase, client, first, last } = await setup();

    const page = await useCase.execute(client, query());

    expect(page.total).toBe(3);
    expect(page.items.every((b) => b.clientId === client.id)).toBe(true);
    expect(page.items[0].id).toBe(last.id);
    expect(page.items[2].id).toBe(first.id);
  });

  it('o prestador vê as reservas dos seus serviços, de todos os clientes', async () => {
    const { useCase, provider, client, otherClient } = await setup();

    const page = await useCase.execute(provider, query());

    expect(page.total).toBe(3);
    expect(page.items.every((b) => b.providerId === provider.id)).toBe(true);
    expect(new Set(page.items.map((b) => b.clientId))).toEqual(
      new Set([client.id, otherClient.id]),
    );
  });

  it('filtra por estado', async () => {
    const { useCase, client, first } = await setup();

    const cancelled = await useCase.execute(
      client,
      query({ status: 'CANCELLED' }),
    );
    const confirmed = await useCase.execute(
      client,
      query({ status: 'CONFIRMED' }),
    );

    expect(cancelled.items.map((b) => b.id)).toEqual([first.id]);
    expect(confirmed.total).toBe(2);
  });

  it('pagina com total correto', async () => {
    const { useCase, client, first } = await setup();

    const page = await useCase.execute(
      client,
      query({ page: '2', perPage: '2' }),
    );

    expect(page.items.map((b) => b.id)).toEqual([first.id]);
    expect(page.total).toBe(3);
  });

  it('o histórico mantém reservas de serviços eliminados, com o nome do momento', async () => {
    const { useCase, client, provider, carla, services } = await setup();
    await new DeleteServiceUseCase(services).execute(provider, carla.id);

    const page = await useCase.execute(client, query());

    expect(page.total).toBe(3);
    expect(
      page.items
        .filter((b) => b.serviceId === carla.id)
        .map((b) => b.serviceName),
    ).toEqual([carla.name, carla.name]);
  });

  it('status inválido → erro de validação', () => {
    expect(
      listBookingsQuerySchema.safeParse({ status: 'PENDING' }).success,
    ).toBe(false);
  });
});

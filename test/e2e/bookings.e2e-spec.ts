import { randomUUID } from 'node:crypto';
import {
  API,
  balanceOf,
  bearer,
  book,
  bookOk,
  createE2eApp,
  createService,
  E2eContext,
  expectError,
  registerUser,
  TestUser,
  topUp,
} from './support/e2e-app';

describe('Reservas e histórico (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** Cliente com saldo, prestador e um serviço com o preço indicado. */
  async function scenario(price: string, clientBalance: string) {
    const [client, provider] = await Promise.all([
      registerUser(ctx, 'CLIENT'),
      registerUser(ctx, 'PROVIDER'),
    ]);
    if (clientBalance !== '0.00') await topUp(ctx, client, clientBalance);
    const service = await createService(ctx, provider, { price });
    return { client, provider, service };
  }

  const cancel = (user: TestUser, bookingId: string) =>
    ctx.http().patch(`${API}/bookings/${bookingId}/cancel`).set(bearer(user));

  describe('POST /bookings', () => {
    it('201: debita o cliente, credita o prestador e congela preço/nome', async () => {
      const { client, provider, service } = await scenario(
        '3000.00',
        '10000.00',
      );

      const res = await book(ctx, client, service.id);

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({
        id: expect.any(String),
        status: 'CONFIRMED',
        price: '3000.00',
        service: { id: service.id, name: service.name },
        client: { id: client.id, fullName: client.fullName },
        provider: { id: provider.id, fullName: provider.fullName },
        createdAt: expect.any(String),
        cancelledAt: null,
        cancelledBy: null,
      });
      expect(await balanceOf(ctx, client)).toBe('7000.00');
      expect(await balanceOf(ctx, provider)).toBe('3000.00');
    });

    it('saldo igual ao preço é suficiente → saldo final 0.00', async () => {
      const { client, service } = await scenario('2500.00', '2500.00');

      expect((await book(ctx, client, service.id)).status).toBe(201);
      expect(await balanceOf(ctx, client)).toBe('0.00');
    });

    it('409 INSUFFICIENT_BALANCE e nenhum saldo muda', async () => {
      const { client, provider, service } = await scenario(
        '2500.00',
        '2499.99',
      );

      const res = await book(ctx, client, service.id);

      expectError(res, 409, 'INSUFFICIENT_BALANCE');
      expect(await balanceOf(ctx, client)).toBe('2499.99');
      expect(await balanceOf(ctx, provider)).toBe('0.00');
      const history = await ctx
        .http()
        .get(`${API}/bookings`)
        .set(bearer(client))
        .expect(200);
      expect(history.body.meta.total).toBe(0);
    });

    it('PROVIDER não reserva (403), nem sequer o serviço de outro', async () => {
      const { service } = await scenario('100.00', '0.00');
      const otherProvider = await registerUser(ctx, 'PROVIDER');

      expectError(await book(ctx, otherProvider, service.id), 403, 'FORBIDDEN');
    });

    it('404 para serviço inexistente ou eliminado; 400 para serviceId inválido', async () => {
      const { client, provider, service } = await scenario('100.00', '1000.00');
      await ctx
        .http()
        .delete(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .expect(204);

      expectError(await book(ctx, client, service.id), 404, 'NOT_FOUND');
      expectError(await book(ctx, client, randomUUID()), 404, 'NOT_FOUND');
      expectError(
        await book(ctx, client, 'nao-e-uuid'),
        400,
        'VALIDATION_ERROR',
      );
      expect(await balanceOf(ctx, client)).toBe('1000.00');
    });

    it('401 sem token', async () => {
      const res = await ctx
        .http()
        .post(`${API}/bookings`)
        .send({ serviceId: randomUUID() });
      expectError(res, 401, 'UNAUTHORIZED');
    });
  });

  describe('PATCH /bookings/:id/cancel', () => {
    it('o cliente cancela → reembolso integral, cancelledBy CLIENT', async () => {
      const { client, provider, service } = await scenario(
        '4000.00',
        '4000.00',
      );
      const booking = await bookOk(ctx, client, service.id);

      const res = await cancel(client, booking.id).expect(200);

      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: booking.id,
          status: 'CANCELLED',
          cancelledBy: 'CLIENT',
          cancelledAt: expect.any(String),
        }),
      );
      expect(await balanceOf(ctx, client)).toBe('4000.00');
      expect(await balanceOf(ctx, provider)).toBe('0.00');
    });

    it('o prestador do serviço cancela → cancelledBy PROVIDER', async () => {
      const { client, provider, service } = await scenario('500.00', '500.00');
      const booking = await bookOk(ctx, client, service.id);

      const res = await cancel(provider, booking.id).expect(200);

      expect(res.body.data.cancelledBy).toBe('PROVIDER');
      expect(await balanceOf(ctx, client)).toBe('500.00');
    });

    it('segundo cancelamento → 409 BOOKING_ALREADY_CANCELLED, sem segundo reembolso', async () => {
      const { client, service } = await scenario('500.00', '500.00');
      const booking = await bookOk(ctx, client, service.id);
      await cancel(client, booking.id).expect(200);

      expectError(
        await cancel(client, booking.id),
        409,
        'BOOKING_ALREADY_CANCELLED',
      );
      expect(await balanceOf(ctx, client)).toBe('500.00');
    });

    it('quem não participa → 403 (cliente ou prestador alheios); inexistente → 404', async () => {
      const { client, service } = await scenario('500.00', '500.00');
      const booking = await bookOk(ctx, client, service.id);
      const [otherClient, otherProvider] = await Promise.all([
        registerUser(ctx, 'CLIENT'),
        registerUser(ctx, 'PROVIDER'),
      ]);

      expectError(await cancel(otherClient, booking.id), 403, 'FORBIDDEN');
      expectError(await cancel(otherProvider, booking.id), 403, 'FORBIDDEN');
      expectError(await cancel(client, randomUUID()), 404, 'NOT_FOUND');
      expect(await balanceOf(ctx, client)).toBe('0.00');
    });

    it('reserva de serviço entretanto eliminado continua cancelável e reembolsa o preço congelado', async () => {
      const { client, provider, service } = await scenario('800.00', '800.00');
      const booking = await bookOk(ctx, client, service.id);
      await ctx
        .http()
        .patch(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .send({ price: '9999.00' })
        .expect(200);
      await ctx
        .http()
        .delete(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .expect(204);

      const res = await cancel(client, booking.id).expect(200);

      expect(res.body.data.price).toBe('800.00');
      expect(await balanceOf(ctx, client)).toBe('800.00');
    });
  });

  describe('Histórico', () => {
    it('GET /bookings: cliente e prestador veem a reserva; terceiros não', async () => {
      const { client, provider, service } = await scenario('100.00', '300.00');
      const first = await bookOk(ctx, client, service.id);
      const second = await bookOk(ctx, client, service.id);
      const outsider = await registerUser(ctx, 'CLIENT');

      const asClient = await ctx
        .http()
        .get(`${API}/bookings`)
        .set(bearer(client))
        .expect(200);
      const asProvider = await ctx
        .http()
        .get(`${API}/bookings`)
        .set(bearer(provider))
        .expect(200);
      const asOutsider = await ctx
        .http()
        .get(`${API}/bookings`)
        .set(bearer(outsider))
        .expect(200);

      // Mais recentes primeiro.
      const ids = (res: { body: { data: { id: string }[] } }) =>
        res.body.data.map((b) => b.id);
      expect(ids(asClient)).toEqual([second.id, first.id]);
      expect(ids(asProvider)).toEqual([second.id, first.id]);
      expect(asOutsider.body.meta).toEqual(
        expect.objectContaining({ total: 0 }),
      );
    });

    it('filtra por status e pagina', async () => {
      const { client, service } = await scenario('100.00', '300.00');
      const bookings: { id: string }[] = [];
      for (let i = 0; i < 3; i++) {
        bookings.push(await bookOk(ctx, client, service.id));
      }
      await cancel(client, bookings[0].id).expect(200);

      const cancelled = await ctx
        .http()
        .get(`${API}/bookings`)
        .query({ status: 'CANCELLED' })
        .set(bearer(client))
        .expect(200);
      const confirmedPage = await ctx
        .http()
        .get(`${API}/bookings`)
        .query({ status: 'CONFIRMED', perPage: 1, page: 2 })
        .set(bearer(client))
        .expect(200);
      const invalid = await ctx
        .http()
        .get(`${API}/bookings`)
        .query({ status: 'PENDING' })
        .set(bearer(client));

      expect(cancelled.body.data.map((b: { id: string }) => b.id)).toEqual([
        bookings[0].id,
      ]);
      expect(confirmedPage.body.meta).toEqual({
        page: 2,
        perPage: 1,
        total: 2,
        totalPages: 2,
      });
      expect(confirmedPage.body.data).toHaveLength(1);
      expectError(invalid, 400, 'VALIDATION_ERROR');
    });

    it('o histórico mantém nome e preço do momento da reserva depois de o serviço mudar', async () => {
      const { client, provider, service } = await scenario('100.00', '100.00');
      const booking = await bookOk(ctx, client, service.id);

      await ctx
        .http()
        .patch(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .send({ name: 'Nome novo do serviço', price: '999.00' })
        .expect(200);

      const res = await ctx
        .http()
        .get(`${API}/bookings/${booking.id}`)
        .set(bearer(client))
        .expect(200);
      expect(res.body.data.price).toBe('100.00');
      expect(res.body.data.service.name).toBe(service.name);
    });

    it('GET /bookings/:id: participante → 200, terceiro → 403, inexistente → 404', async () => {
      const { client, provider, service } = await scenario('100.00', '100.00');
      const booking = await bookOk(ctx, client, service.id);
      const outsider = await registerUser(ctx, 'PROVIDER');

      await ctx
        .http()
        .get(`${API}/bookings/${booking.id}`)
        .set(bearer(provider))
        .expect(200);
      expectError(
        await ctx
          .http()
          .get(`${API}/bookings/${booking.id}`)
          .set(bearer(outsider)),
        403,
        'FORBIDDEN',
      );
      expectError(
        await ctx
          .http()
          .get(`${API}/bookings/${randomUUID()}`)
          .set(bearer(client)),
        404,
        'NOT_FOUND',
      );
    });

    it('extrato do cliente e do prestador: débito, crédito e reembolsos com sinal e balanceAfter', async () => {
      const { client, provider, service } = await scenario(
        '1200.00',
        '2000.00',
      );
      const booking = await bookOk(ctx, client, service.id);
      await cancel(provider, booking.id).expect(200);

      const statement = async (user: TestUser) =>
        (
          await ctx
            .http()
            .get(`${API}/wallet/transactions`)
            .set(bearer(user))
            .expect(200)
        ).body.data.map(
          (t: { type: string; amount: string; balanceAfter: string }) => [
            t.type,
            t.amount,
            t.balanceAfter,
          ],
        );

      expect(await statement(client)).toEqual([
        ['REFUND_CREDIT', '1200.00', '2000.00'],
        ['BOOKING_DEBIT', '-1200.00', '800.00'],
        ['TOP_UP', '2000.00', '2000.00'],
      ]);
      expect(await statement(provider)).toEqual([
        ['REFUND_DEBIT', '-1200.00', '0.00'],
        ['BOOKING_CREDIT', '1200.00', '1200.00'],
      ]);
    });
  });
});

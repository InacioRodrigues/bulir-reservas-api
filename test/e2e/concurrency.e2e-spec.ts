/**
 * Concorrência ponta a ponta: pedidos HTTP realmente paralelos, cada um no
 * seu ciclo pedido → guard → use case → transação no PostgreSQL. Complementa
 * `test/integration`, que testa os use cases diretamente contra a BD.
 */
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

type Movement = { amount: string };

describe('Concorrência via HTTP (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const statuses = (results: { status: number }[]) =>
    results.map((r) => r.status).sort((a, b) => a - b);

  /** Soma do extrato em cêntimos — tem de coincidir com o saldo. */
  async function ledgerSumCents(user: TestUser): Promise<number> {
    const res = await ctx
      .http()
      .get(`${API}/wallet/transactions`)
      .query({ perPage: 100 })
      .set(bearer(user))
      .expect(200);
    const movements = (res.body as { data: Movement[] }).data;
    return movements.reduce(
      (sum, m) => sum + Math.round(Number(m.amount) * 100),
      0,
    );
  }

  const cents = (amount: string) => Math.round(Number(amount) * 100);

  it('saldo para 3 reservas e 10 pedidos em paralelo → exatamente 3 × 201, 7 × 409, saldo 0.00', async () => {
    const [client, provider] = await Promise.all([
      registerUser(ctx, 'CLIENT'),
      registerUser(ctx, 'PROVIDER'),
    ]);
    const service = await createService(ctx, provider, { price: '5000.00' });
    await topUp(ctx, client, '15000.00');

    const results = await Promise.all(
      Array.from({ length: 10 }, () => book(ctx, client, service.id)),
    );

    expect(statuses(results)).toEqual([
      ...Array<number>(3).fill(201),
      ...Array<number>(7).fill(409),
    ]);
    results
      .filter((r) => r.status === 409)
      .forEach((r) => expectError(r, 409, 'INSUFFICIENT_BALANCE'));

    expect(await balanceOf(ctx, client)).toBe('0.00');
    expect(await balanceOf(ctx, provider)).toBe('15000.00');
    const history = await ctx
      .http()
      .get(`${API}/bookings`)
      .set(bearer(client))
      .expect(200);
    expect(history.body.meta.total).toBe(3);
    expect(await ledgerSumCents(client)).toBe(0);
    expect(await ledgerSumCents(provider)).toBe(cents('15000.00'));
  });

  it('10 cancelamentos em paralelo da mesma reserva → 1 × 200, 9 × 409 e um só reembolso', async () => {
    const [client, provider] = await Promise.all([
      registerUser(ctx, 'CLIENT'),
      registerUser(ctx, 'PROVIDER'),
    ]);
    const service = await createService(ctx, provider, { price: '7500.00' });
    await topUp(ctx, client, '10000.00');
    const booking = await bookOk(ctx, client, service.id);

    // Metade dos pedidos vem do cliente e metade do prestador.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        ctx
          .http()
          .patch(`${API}/bookings/${booking.id}/cancel`)
          .set(bearer(i % 2 === 0 ? client : provider)),
      ),
    );

    expect(statuses(results)).toEqual([200, ...Array<number>(9).fill(409)]);
    results
      .filter((r) => r.status === 409)
      .forEach((r) => expectError(r, 409, 'BOOKING_ALREADY_CANCELLED'));
    expect(await balanceOf(ctx, client)).toBe('10000.00');
    expect(await balanceOf(ctx, provider)).toBe('0.00');
    expect(await ledgerSumCents(client)).toBe(cents('10000.00'));
  });

  it('20 carregamentos em paralelo → nenhum se perde (sem lost update)', async () => {
    const client = await registerUser(ctx, 'CLIENT');

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        ctx
          .http()
          .post(`${API}/wallet/top-up`)
          .set(bearer(client))
          .send({ amount: '100.25' }),
      ),
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await balanceOf(ctx, client)).toBe('2005.00');
    expect(await ledgerSumCents(client)).toBe(cents('2005.00'));
  });

  it('reservas e cancelamentos cruzados entre vários clientes e prestadores → dinheiro conservado, nenhum saldo negativo', async () => {
    const clients = await Promise.all(
      Array.from({ length: 3 }, () => registerUser(ctx, 'CLIENT')),
    );
    const providers = await Promise.all(
      Array.from({ length: 2 }, () => registerUser(ctx, 'PROVIDER')),
    );
    const services = await Promise.all(
      providers.map((p, i) =>
        createService(ctx, p, { price: i === 0 ? '300.00' : '450.00' }),
      ),
    );
    await Promise.all(clients.map((c) => topUp(ctx, c, '1000.00')));
    // Uma reserva prévia por cliente para haver o que cancelar a meio.
    const toCancel = await Promise.all(
      clients.map((c, i) => bookOk(ctx, c, services[i % 2].id)),
    );

    const operations = [
      ...clients.flatMap((c) =>
        services.flatMap((s) => [book(ctx, c, s.id), book(ctx, c, s.id)]),
      ),
      ...toCancel.map((b, i) =>
        ctx
          .http()
          .patch(`${API}/bookings/${b.id}/cancel`)
          .set(bearer(i % 2 === 0 ? clients[i] : providers[i % 2])),
      ),
    ];
    const results = await Promise.all(operations);

    // Só respostas de negócio: nenhum 500 (deadlock, CHECK violado, timeout).
    expect(results.every((r) => [200, 201, 409].includes(r.status))).toBe(true);

    const everyone = [...clients, ...providers];
    const balances = await Promise.all(everyone.map((u) => balanceOf(ctx, u)));
    balances.forEach((b) => expect(cents(b)).toBeGreaterThanOrEqual(0));
    const total = balances.reduce((sum, b) => sum + cents(b), 0);
    expect(total).toBe(cents('3000.00'));
    for (const [i, user] of everyone.entries()) {
      expect(await ledgerSumCents(user)).toBe(cents(balances[i]));
    }
  });
});

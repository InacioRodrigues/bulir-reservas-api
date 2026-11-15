import {
  API,
  balanceOf,
  bearer,
  createE2eApp,
  E2eContext,
  expectError,
  registerUser,
} from './support/e2e-app';

describe('Carteira (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('POST /wallet/top-up → 200 com o novo saldo; acumula e fica no extrato', async () => {
    const client = await registerUser(ctx, 'CLIENT');

    const first = await ctx
      .http()
      .post(`${API}/wallet/top-up`)
      .set(bearer(client))
      .send({ amount: '5000' })
      .expect(200);
    expect(first.body.data).toEqual({ balance: '5000.00' });

    await ctx
      .http()
      .post(`${API}/wallet/top-up`)
      .set(bearer(client))
      .send({ amount: '0.50' })
      .expect(200);
    expect(await balanceOf(ctx, client)).toBe('5000.50');

    const statement = await ctx
      .http()
      .get(`${API}/wallet/transactions`)
      .set(bearer(client))
      .expect(200);
    expect(statement.body.meta).toEqual(
      expect.objectContaining({ page: 1, total: 2 }),
    );
    // Mais recentes primeiro, com sinal e saldo após cada movimento.
    expect(statement.body.data).toEqual([
      expect.objectContaining({
        type: 'TOP_UP',
        amount: '0.50',
        balanceAfter: '5000.50',
        bookingId: null,
      }),
      expect.objectContaining({
        type: 'TOP_UP',
        amount: '5000.00',
        balanceAfter: '5000.00',
      }),
    ]);
  });

  it('403 FORBIDDEN para PROVIDER', async () => {
    const provider = await registerUser(ctx, 'PROVIDER');
    const res = await ctx
      .http()
      .post(`${API}/wallet/top-up`)
      .set(bearer(provider))
      .send({ amount: '100.00' });
    expectError(res, 403, 'FORBIDDEN');
  });

  it('401 sem token', async () => {
    const res = await ctx
      .http()
      .post(`${API}/wallet/top-up`)
      .send({ amount: '100.00' });
    expectError(res, 401, 'UNAUTHORIZED');
  });

  it.each([['0'], ['-1.00'], ['1000000.01'], ['12.345'], ['abc']])(
    '400 VALIDATION_ERROR com amount %s e o saldo não muda',
    async (amount) => {
      const client = await registerUser(ctx, 'CLIENT');
      const res = await ctx
        .http()
        .post(`${API}/wallet/top-up`)
        .set(bearer(client))
        .send({ amount });
      expectError(res, 400, 'VALIDATION_ERROR');
      expect(await balanceOf(ctx, client)).toBe('0.00');
    },
  );

  it('aceita o máximo permitido (1 000 000.00)', async () => {
    const client = await registerUser(ctx, 'CLIENT');
    await ctx
      .http()
      .post(`${API}/wallet/top-up`)
      .set(bearer(client))
      .send({ amount: '1000000.00' })
      .expect(200);
  });
});

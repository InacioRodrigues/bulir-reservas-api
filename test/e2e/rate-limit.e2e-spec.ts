/**
 * Os outros ficheiros e2e correm com limites altos (`test/setup/test-env.ts`).
 * Aqui baixam-se os limites por rota — lidos em cada pedido — para provar
 * que o rate limiting está ligado e responde no formato do contrato.
 */
import { Response } from 'supertest';
import {
  API,
  bearer,
  createE2eApp,
  E2eContext,
  expectError,
  registerUser,
} from './support/e2e-app';

describe('Rate limiting (e2e)', () => {
  let ctx: E2eContext;
  const original = {
    auth: process.env.AUTH_THROTTLE_LIMIT,
    money: process.env.MONEY_THROTTLE_LIMIT,
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterEach(() => {
    process.env.AUTH_THROTTLE_LIMIT = original.auth;
    process.env.MONEY_THROTTLE_LIMIT = original.money;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('login acima do limite por IP → 429 TOO_MANY_REQUESTS com Retry-After', async () => {
    const user = await registerUser(ctx, 'CLIENT');
    process.env.AUTH_THROTTLE_LIMIT = '3';

    const attempts: Response[] = [];
    for (let i = 0; i < 4; i++) {
      attempts.push(
        await ctx
          .http()
          .post(`${API}/auth/login`)
          .send({ identifier: user.email, password: 'Errada123' }),
      );
    }

    expect(attempts.slice(0, 3).map((r) => r.status)).toEqual([401, 401, 401]);
    expectError(attempts[3], 429, 'TOO_MANY_REQUESTS');
    expect(Number(attempts[3].headers['retry-after'])).toBeGreaterThan(0);
  });

  it('operações de dinheiro contam por utilizador: o limite de um não afeta outro', async () => {
    const [alice, bruno] = await Promise.all([
      registerUser(ctx, 'CLIENT', 'alice'),
      registerUser(ctx, 'CLIENT', 'bruno'),
    ]);
    process.env.MONEY_THROTTLE_LIMIT = '2';

    const topUp = (user: typeof alice) =>
      ctx
        .http()
        .post(`${API}/wallet/top-up`)
        .set(bearer(user))
        .send({ amount: '10.00' });

    expect((await topUp(alice)).status).toBe(200);
    expect((await topUp(alice)).status).toBe(200);
    expectError(await topUp(alice), 429, 'TOO_MANY_REQUESTS');
    expect((await topUp(bruno)).status).toBe(200);
  });
});

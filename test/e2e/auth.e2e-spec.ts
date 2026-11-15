import {
  API,
  bearer,
  createE2eApp,
  E2eContext,
  expectError,
  registerUser,
  uniqueIdentity,
} from './support/e2e-app';

describe('Cadastro e autenticação (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const register = (body: Record<string, unknown>) =>
    ctx.http().post(`${API}/auth/register`).send(body);
  const login = (identifier: string, password: string) =>
    ctx.http().post(`${API}/auth/login`).send({ identifier, password });

  describe('POST /auth/register', () => {
    it('201 com utilizador público (sem hash) e par de tokens; saldo inicial 0.00', async () => {
      const identity = uniqueIdentity('registo');
      const res = await register({ ...identity, role: 'CLIENT' }).expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        user: {
          id: expect.any(String),
          fullName: identity.fullName,
          nif: identity.nif,
          email: identity.email,
          role: 'CLIENT',
          balance: '0.00',
          createdAt: expect.any(String),
        },
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('normaliza e-mail (minúsculas, trim) e NIF (maiúsculas, sem espaços)', async () => {
      const identity = uniqueIdentity('normaliza');
      const res = await register({
        ...identity,
        email: `  ${identity.email.toUpperCase()}  `,
        nif: ` ${identity.nif.toLowerCase()} `,
        role: 'PROVIDER',
      }).expect(201);

      expect(res.body.data.user.email).toBe(identity.email);
      expect(res.body.data.user.nif).toBe(identity.nif);
    });

    it('ignora campos não previstos (mass assignment de balance/id)', async () => {
      const identity = uniqueIdentity('massa');
      const res = await register({
        ...identity,
        role: 'CLIENT',
        balance: '999999.00',
        id: '00000000-0000-4000-8000-000000000000',
      }).expect(201);

      expect(res.body.data.user.balance).toBe('0.00');
      expect(res.body.data.user.id).not.toBe(
        '00000000-0000-4000-8000-000000000000',
      );
    });

    it('409 EMAIL_ALREADY_EXISTS sem distinguir maiúsculas', async () => {
      const existing = await registerUser(ctx, 'CLIENT');
      const res = await register({
        ...uniqueIdentity(),
        email: existing.email.toUpperCase(),
        role: 'CLIENT',
      });
      expectError(res, 409, 'EMAIL_ALREADY_EXISTS');
    });

    it('409 NIF_ALREADY_EXISTS (comparado depois de normalizado)', async () => {
      const existing = await registerUser(ctx, 'PROVIDER');
      const res = await register({
        ...uniqueIdentity(),
        nif: existing.nif.toLowerCase(),
        role: 'PROVIDER',
      });
      expectError(res, 409, 'NIF_ALREADY_EXISTS');
    });

    it('registos simultâneos com o mesmo e-mail → um 201, os restantes 409 (UNIQUE da BD)', async () => {
      const identity = uniqueIdentity('corrida');
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          register({
            ...identity,
            nif: `${identity.nif}${i}`,
            role: 'CLIENT',
          }),
        ),
      );

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      results
        .filter((r) => r.status === 409)
        .forEach((r) => expectError(r, 409, 'EMAIL_ALREADY_EXISTS'));
    });

    it('400 VALIDATION_ERROR com erros por campo', async () => {
      const res = await register({
        fullName: 'A',
        nif: '12',
        email: 'nao-e-email',
        password: 'curta',
        role: 'ADMIN',
      });

      expectError(res, 400, 'VALIDATION_ERROR');
      const fields = (res.body.errors as { field: string }[]).map(
        (e) => e.field,
      );
      expect(fields).toEqual(
        expect.arrayContaining([
          'fullName',
          'nif',
          'email',
          'password',
          'role',
        ]),
      );
    });

    it('400 quando a password não tem letra e número', async () => {
      const res = await register({
        ...uniqueIdentity(),
        password: 'sonumerosnao',
        role: 'CLIENT',
      });
      expectError(res, 400, 'VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
    it('200 com e-mail (qualquer capitalização)', async () => {
      const user = await registerUser(ctx, 'CLIENT');
      const res = await login(user.email.toUpperCase(), user.password).expect(
        200,
      );

      expect(res.body.data.user.id).toBe(user.id);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('200 com NIF', async () => {
      const user = await registerUser(ctx, 'PROVIDER');
      const res = await login(user.nif.toLowerCase(), user.password).expect(
        200,
      );
      expect(res.body.data.user).toEqual(
        expect.objectContaining({ id: user.id, role: 'PROVIDER' }),
      );
    });

    it('401 INVALID_CREDENTIALS genérico: password errada e utilizador inexistente dão a mesma resposta', async () => {
      const user = await registerUser(ctx, 'CLIENT');

      const wrongPassword = await login(user.email, 'Errada123');
      const unknownUser = await login('ninguem@e2e.test', 'Errada123');

      expectError(wrongPassword, 401, 'INVALID_CREDENTIALS');
      expectError(unknownUser, 401, 'INVALID_CREDENTIALS');
      expect(wrongPassword.body.message).toBe(unknownUser.body.message);
    });
  });

  describe('GET /auth/me', () => {
    it('200 com o perfil e saldo do utilizador do token', async () => {
      const user = await registerUser(ctx, 'CLIENT');
      const res = await ctx
        .http()
        .get(`${API}/auth/me`)
        .set(bearer(user))
        .expect(200);

      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: user.id,
          email: user.email,
          balance: '0.00',
        }),
      );
    });

    it('401 UNAUTHORIZED sem token, com token inválido ou com esquema errado', async () => {
      const user = await registerUser(ctx, 'CLIENT');
      const noToken = await ctx.http().get(`${API}/auth/me`);
      const garbage = await ctx
        .http()
        .get(`${API}/auth/me`)
        .set('Authorization', 'Bearer abc.def.ghi');
      // O refresh token é assinado com outro segredo: não serve como access.
      const refreshAsAccess = await ctx
        .http()
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${user.refreshToken}`);

      for (const res of [noToken, garbage, refreshAsAccess]) {
        expectError(res, 401, 'UNAUTHORIZED');
      }
    });
  });

  describe('POST /auth/refresh e /auth/logout', () => {
    it('roda o refresh token: o novo funciona e o antigo deixa de funcionar', async () => {
      const user = await registerUser(ctx, 'CLIENT');

      const rotated = await ctx
        .http()
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      const { accessToken, refreshToken } = rotated.body.data;
      expect(refreshToken).not.toBe(user.refreshToken);

      await ctx
        .http()
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const reuse = await ctx
        .http()
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken });
      expectError(reuse, 401, 'UNAUTHORIZED');
    });

    it('logout → 204 e o refresh token fica revogado', async () => {
      const user = await registerUser(ctx, 'PROVIDER');

      await ctx
        .http()
        .post(`${API}/auth/logout`)
        .set(bearer(user))
        .send({ refreshToken: user.refreshToken })
        .expect(204);

      const res = await ctx
        .http()
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: user.refreshToken });
      expectError(res, 401, 'UNAUTHORIZED');
    });
  });
});

import { randomUUID, randomBytes } from 'node:crypto';
import {
  API,
  bearer,
  createE2eApp,
  createService,
  E2eContext,
  expectError,
  registerUser,
  TestUser,
} from './support/e2e-app';

describe('Serviços (e2e)', () => {
  let ctx: E2eContext;
  let provider: TestUser;
  let otherProvider: TestUser;
  let client: TestUser;

  beforeAll(async () => {
    ctx = await createE2eApp();
    [provider, otherProvider, client] = await Promise.all([
      registerUser(ctx, 'PROVIDER', 'prestador'),
      registerUser(ctx, 'PROVIDER', 'outro'),
      registerUser(ctx, 'CLIENT', 'cliente'),
    ]);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const validBody = {
    name: 'Canalização',
    description: 'Reparação de fugas e torneiras',
    price: '1500',
  };

  describe('POST /services', () => {
    it('201 para PROVIDER: preço normalizado a 2 casas e prestador associado', async () => {
      const res = await ctx
        .http()
        .post(`${API}/services`)
        .set(bearer(provider))
        .send(validBody)
        .expect(201);

      expect(res.body.data).toEqual({
        id: expect.any(String),
        name: 'Canalização',
        description: 'Reparação de fugas e torneiras',
        price: '1500.00',
        provider: { id: provider.id, fullName: provider.fullName },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('ignora providerId no corpo: o dono é sempre o utilizador do token', async () => {
      const res = await ctx
        .http()
        .post(`${API}/services`)
        .set(bearer(provider))
        .send({ ...validBody, providerId: otherProvider.id })
        .expect(201);
      expect(res.body.data.provider.id).toBe(provider.id);
    });

    it('403 FORBIDDEN para CLIENT', async () => {
      const res = await ctx
        .http()
        .post(`${API}/services`)
        .set(bearer(client))
        .send(validBody);
      expectError(res, 403, 'FORBIDDEN');
    });

    it('401 UNAUTHORIZED sem token', async () => {
      const res = await ctx.http().post(`${API}/services`).send(validBody);
      expectError(res, 401, 'UNAUTHORIZED');
    });

    it.each([
      ['zero', '0'],
      ['negativo', '-10.00'],
      ['3 casas decimais', '10.001'],
      ['número JSON em vez de string', 1500],
      ['acima do máximo', '10000000.01'],
    ])('400 VALIDATION_ERROR com preço %s', async (_label, price) => {
      const res = await ctx
        .http()
        .post(`${API}/services`)
        .set(bearer(provider))
        .send({ ...validBody, price });
      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'price' })]),
      );
    });

    it('guarda HTML como texto e responde sempre em JSON (sem refletir HTML)', async () => {
      const name = '<script>alert(1)</script>';
      const res = await ctx
        .http()
        .post(`${API}/services`)
        .set(bearer(provider))
        .send({ ...validBody, name })
        .expect(201);

      expect(res.headers['content-type']).toMatch(/^application\/json/);
      expect(res.body.data.name).toBe(name);
    });
  });

  describe('GET /services', () => {
    const tag = `Tag${randomBytes(4).toString('hex')}`;

    beforeAll(async () => {
      for (const [name, price] of [
        ['Aula de piano', '3000.00'],
        ['Aula de guitarra', '2000.00'],
        ['Explicação de matemática', '1000.00'],
      ]) {
        await createService(ctx, provider, {
          name: `${name} ${tag}`,
          price,
        });
      }
    });

    it('lista paginada com meta, pesquisa sem distinguir maiúsculas e ordenação por preço', async () => {
      const res = await ctx
        .http()
        .get(`${API}/services`)
        .query({ search: tag.toUpperCase(), sort: 'price_asc', perPage: 2 })
        .set(bearer(client))
        .expect(200);

      expect(res.body.meta).toEqual({
        page: 1,
        perPage: 2,
        total: 3,
        totalPages: 2,
      });
      expect(res.body.data.map((s: { price: string }) => s.price)).toEqual([
        '1000.00',
        '2000.00',
      ]);
    });

    it('filtra por intervalo de preço (inclusivo)', async () => {
      const res = await ctx
        .http()
        .get(`${API}/services`)
        .query({ search: tag, minPrice: '2000', maxPrice: '3000' })
        .set(bearer(client))
        .expect(200);

      expect(
        res.body.data.map((s: { price: string }) => s.price).sort(),
      ).toEqual(['2000.00', '3000.00']);
    });

    it('400 com perPage acima de 100 ou maxPrice < minPrice', async () => {
      const tooMany = await ctx
        .http()
        .get(`${API}/services`)
        .query({ perPage: 101 })
        .set(bearer(client));
      const badRange = await ctx
        .http()
        .get(`${API}/services`)
        .query({ minPrice: '50', maxPrice: '10' })
        .set(bearer(client));

      expectError(tooMany, 400, 'VALIDATION_ERROR');
      expectError(badRange, 400, 'VALIDATION_ERROR');
    });

    it('pesquisa com % e _ é literal (não é wildcard de LIKE)', async () => {
      const res = await ctx
        .http()
        .get(`${API}/services`)
        .query({ search: `${tag}%` })
        .set(bearer(client))
        .expect(200);
      expect(res.body.meta.total).toBe(0);
    });

    it('GET /services/mine: só os do prestador autenticado; CLIENT → 403', async () => {
      await createService(ctx, otherProvider, { name: `Do outro ${tag}` });

      const mine = await ctx
        .http()
        .get(`${API}/services/mine`)
        .query({ perPage: 100 })
        .set(bearer(otherProvider))
        .expect(200);
      expect(
        mine.body.data.every(
          (s: { provider: { id: string } }) =>
            s.provider.id === otherProvider.id,
        ),
      ).toBe(true);

      const asClient = await ctx
        .http()
        .get(`${API}/services/mine`)
        .set(bearer(client));
      expectError(asClient, 403, 'FORBIDDEN');
    });
  });

  describe('GET /services/:id', () => {
    it('200 para qualquer utilizador autenticado', async () => {
      const service = await createService(ctx, provider);
      const res = await ctx
        .http()
        .get(`${API}/services/${service.id}`)
        .set(bearer(client))
        .expect(200);
      expect(res.body.data.id).toBe(service.id);
    });

    it('400 com id que não é UUID e 404 com UUID inexistente', async () => {
      const notUuid = await ctx
        .http()
        .get(`${API}/services/123`)
        .set(bearer(client));
      const missing = await ctx
        .http()
        .get(`${API}/services/${randomUUID()}`)
        .set(bearer(client));

      expectError(notUuid, 400, 'VALIDATION_ERROR');
      expectError(missing, 404, 'NOT_FOUND');
    });
  });

  describe('PATCH e DELETE /services/:id (ownership)', () => {
    it('o dono edita parcialmente → 200', async () => {
      const service = await createService(ctx, provider);
      const res = await ctx
        .http()
        .patch(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .send({ price: '7500.5' })
        .expect(200);

      expect(res.body.data).toEqual(
        expect.objectContaining({ price: '7500.50', name: service.name }),
      );
    });

    it('400 com corpo vazio', async () => {
      const service = await createService(ctx, provider);
      const res = await ctx
        .http()
        .patch(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .send({});
      expectError(res, 400, 'VALIDATION_ERROR');
    });

    it('outro prestador → 403 a editar e a eliminar; o serviço fica intacto', async () => {
      const service = await createService(ctx, provider);

      const edit = await ctx
        .http()
        .patch(`${API}/services/${service.id}`)
        .set(bearer(otherProvider))
        .send({ price: '1.00' });
      const remove = await ctx
        .http()
        .delete(`${API}/services/${service.id}`)
        .set(bearer(otherProvider));

      expectError(edit, 403, 'FORBIDDEN');
      expectError(remove, 403, 'FORBIDDEN');
      const after = await ctx
        .http()
        .get(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .expect(200);
      expect(after.body.data.price).toBe(service.price);
    });

    it('CLIENT → 403 a editar', async () => {
      const service = await createService(ctx, provider);
      const res = await ctx
        .http()
        .patch(`${API}/services/${service.id}`)
        .set(bearer(client))
        .send({ price: '1.00' });
      expectError(res, 403, 'FORBIDDEN');
    });

    it('o dono elimina → 204; depois GET/PATCH/DELETE → 404 e sai da listagem', async () => {
      const service = await createService(ctx, provider, {
        name: `Para eliminar ${randomBytes(4).toString('hex')}`,
      });

      await ctx
        .http()
        .delete(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .expect(204);

      const get = await ctx
        .http()
        .get(`${API}/services/${service.id}`)
        .set(bearer(client));
      const patch = await ctx
        .http()
        .patch(`${API}/services/${service.id}`)
        .set(bearer(provider))
        .send({ price: '10.00' });
      const again = await ctx
        .http()
        .delete(`${API}/services/${service.id}`)
        .set(bearer(provider));
      expectError(get, 404, 'NOT_FOUND');
      expectError(patch, 404, 'NOT_FOUND');
      expectError(again, 404, 'NOT_FOUND');

      const list = await ctx
        .http()
        .get(`${API}/services`)
        .query({ search: service.name })
        .set(bearer(client))
        .expect(200);
      expect(list.body.meta.total).toBe(0);
    });
  });
});

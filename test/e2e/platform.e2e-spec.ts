import { API, createE2eApp, E2eContext, expectError } from './support/e2e-app';

describe('Plataforma HTTP (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /health → 200 no formato do contrato, dentro do envelope', async () => {
    const res = await ctx.http().get(`${API}/health`).expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          status: 'ok',
          db: 'up',
          uptime: expect.any(Number),
          timestamp: expect.any(String),
        },
      }),
    );
    expect(new Date(String(res.body.data.timestamp)).toISOString()).toBe(
      res.body.data.timestamp,
    );
  });

  it('responde com headers de segurança e ids de pedido', async () => {
    const res = await ctx.http().get(`${API}/health`).expect(200);

    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('rota inexistente → 404 NOT_FOUND com o corpo de erro padrão', async () => {
    const res = await ctx.http().get(`${API}/nao-existe`);
    expectError(res, 404, 'NOT_FOUND');
    expect(res.body.path).toBe(`${API}/nao-existe`);
  });

  it('corpo que não é JSON → 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await ctx
      .http()
      .post(`${API}/auth/login`)
      .set('Content-Type', 'text/plain')
      .send('identifier=a&password=b');
    expectError(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('corpo acima do limite → 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ identifier: 'x'.repeat(20 * 1024), password: 'y' });
    expectError(res, 413, 'PAYLOAD_TOO_LARGE');
  });

  it('JSON mal formado → 400 com o corpo de erro padrão', async () => {
    const res = await ctx
      .http()
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"identifier":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({ success: false, statusCode: 400 }),
    );
  });

  it('GET /openapi.json → documento OpenAPI com as rotas do contrato', async () => {
    const res = await ctx.http().get('/openapi.json').expect(200);

    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths as object)).toEqual(
      expect.arrayContaining([
        `${API}/auth/register`,
        `${API}/auth/login`,
        `${API}/services`,
        `${API}/bookings`,
        `${API}/wallet/top-up`,
      ]),
    );
  });

  it('GET /reference → documentação Scalar com CSP de nonce', async () => {
    const res = await ctx.http().get('/reference').expect(200);

    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toMatch(/'nonce-[^']+'/);
  });
});

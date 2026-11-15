/**
 * Arranque da aplicação para os testes e2e: o mesmo `AppModule` e o mesmo
 * pipeline HTTP de `main.ts` (`configureHttpApp`), contra a BD de testes
 * definida em `test/setup/test-env.ts`. Os pedidos vão por Supertest para uma
 * porta efémera.
 */
import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request, { Response } from 'supertest';
import { AppModule } from '../../../src/app.module';
import { configureHttpApp } from '../../../src/bootstrap/configure-http-app';

export const API = '/api/v1';

export type Role = 'CLIENT' | 'PROVIDER';

export interface TestUser {
  id: string;
  fullName: string;
  email: string;
  nif: string;
  role: Role;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export interface E2eContext {
  app: NestExpressApplication;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function createE2eApp(): Promise<E2eContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureHttpApp(app);
  // Porta efémera em loopback (nunca a 3000 da API de desenvolvimento). Com o
  // servidor já à escuta, o Supertest reutiliza-o em vez de abrir um servidor
  // por pedido — necessário para dezenas de pedidos em paralelo.
  await app.listen(0, '127.0.0.1');

  return {
    app,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

/** E-mail e NIF únicos por chamada: os testes não dependem uns dos outros. */
export function uniqueIdentity(label = 'user') {
  const tag = randomBytes(5).toString('hex').toUpperCase();
  return {
    fullName: `Teste E2E ${label} ${tag}`,
    email: `${label}.${tag.toLowerCase()}@e2e.test`,
    nif: `E2E${tag}`,
    password: 'Segura123',
  };
}

export async function registerUser(
  ctx: E2eContext,
  role: Role,
  label: string = role.toLowerCase(),
): Promise<TestUser> {
  const identity = uniqueIdentity(label);
  const res = await ctx
    .http()
    .post(`${API}/auth/register`)
    .send({ ...identity, role })
    .expect(201);

  const body = res.body as {
    data: {
      user: { id: string; fullName: string; email: string; nif: string };
      accessToken: string;
      refreshToken: string;
    };
  };
  return {
    ...identity,
    ...body.data.user,
    role,
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
  };
}

export const bearer = (user: Pick<TestUser, 'accessToken'>) => ({
  Authorization: `Bearer ${user.accessToken}`,
});

/** Corpo de erro do contrato: mesmo formato em todos os códigos. */
export function expectError(res: Response, status: number, code: string) {
  expect({
    status: res.status,
    code: (res.body as { code?: string }).code,
  }).toEqual({
    status,
    code,
  });
  expect(res.body).toEqual(
    expect.objectContaining({
      success: false,
      statusCode: status,
      code,
      message: expect.any(String),
      path: expect.stringMatching(/^\//),
      timestamp: expect.any(String),
      correlationId: expect.any(String),
    }),
  );
}

export async function balanceOf(
  ctx: E2eContext,
  user: TestUser,
): Promise<string> {
  const res = await ctx
    .http()
    .get(`${API}/auth/me`)
    .set(bearer(user))
    .expect(200);
  return (res.body as { data: { balance: string } }).data.balance;
}

export function topUp(ctx: E2eContext, client: TestUser, amount: string) {
  return ctx
    .http()
    .post(`${API}/wallet/top-up`)
    .set(bearer(client))
    .send({ amount })
    .expect(200);
}

export async function createService(
  ctx: E2eContext,
  provider: TestUser,
  overrides: Partial<{ name: string; description: string; price: string }> = {},
): Promise<{ id: string; name: string; price: string }> {
  const res = await ctx
    .http()
    .post(`${API}/services`)
    .set(bearer(provider))
    .send({
      name: 'Corte de cabelo',
      description: 'Corte e lavagem ao domicílio',
      price: '5000.00',
      ...overrides,
    })
    .expect(201);
  return (res.body as { data: { id: string; name: string; price: string } })
    .data;
}

export function book(ctx: E2eContext, client: TestUser, serviceId: string) {
  return ctx
    .http()
    .post(`${API}/bookings`)
    .set(bearer(client))
    .send({ serviceId });
}

export interface BookingBody {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED';
  price: string;
}

/** Reserva que tem de ter sucesso (201). */
export async function bookOk(
  ctx: E2eContext,
  client: TestUser,
  serviceId: string,
): Promise<BookingBody> {
  const res = await book(ctx, client, serviceId).expect(201);
  return (res.body as { data: BookingBody }).data;
}

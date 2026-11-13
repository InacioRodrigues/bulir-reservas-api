# Progresso — Desafio 1 (Backend)

- [x] **Fase 0** — Setup do projeto (NestJS + Prisma + Docker, build/lint/testes verdes, repo público)
- [x] **Fase 1** — Modelo de dados (User, Service, Booking, WalletTransaction, RefreshToken, CHECKs, seed)
- [x] **Fase 2** — Cadastro e autenticação (NIF/e-mail únicos, login por e-mail ou NIF, JWT, RBAC)
- [x] **Fase 3** — Serviços (CRUD do prestador, ownership, soft delete, listagem paginada)
- [x] **Fase 4** — Carteira e reservas (top-up, reserva e cancelamento atómicos, ledger)
- [x] **Fase 5** — Histórico (reservas e movimentos de carteira paginados, sem N+1)
- [x] **Fase 6** — Segurança e desempenho (Helmet, CORS, rate limiting, XSS/CSRF/SQLi, índices)
- [ ] **Fase 7** — Testes (unit + e2e com Postgres real, teste de concorrência, CI)
- [ ] **Fase 8** — Docker, documentação e deploy
- [ ] **Fase 9** — Revisão final (checklist requisito → ficheiro/teste)

## Notas da Fase 0

- Sem endpoints `verify-email`, `forgot-password` e `reset-password` (não há envio de e-mail no âmbito do desafio).
- Logout apaga a sessão do refresh token na BD (PostgreSQL é a única dependência de infraestrutura).

## Notas da Fase 1

- Migrações: `20261113200621_init` (tabelas, enums, índices) e `20261113200629_add_check_constraints` (CHECKs manuais).
- `wallet_transactions.amount` tem sinal (+ crédito / − débito) — ver README › Decisões.
- Domínio `User` alinhado (fullName, nif, role CLIENT/PROVIDER, balance só de leitura); sem rotas `/users` (o perfil é lido em `GET /auth/me`).
- Corrigido `tsconfig.build.json` (o build compilava `prisma/` e o entrypoint ia para `dist/src/main`).
- Pendente para a Fase 7: `test/app.e2e-spec.ts` não compila (`import * as request from 'supertest'`).

## Notas da Fase 2

- Auth em use cases (`register`, `login`, `refresh-session`, `logout`) com portas `ITokenService`,
  `IRefreshTokenRepository` e `IPasswordHasher`; testes unitários com repositórios em memória (`test/fakes`).
- Corpo de erro do contrato (`statusCode`, `code`, `correlationId`); validação passa a `400 VALIDATION_ERROR`.
- Refresh tokens guardados como SHA-256, com `jti` aleatório e rotação condicional (deteção de reutilização).
- Rate limiting: global 100/min; `login`/`register` 5/min (`AUTH_THROTTLE_LIMIT`); `refresh` 20/min.
- Removido `PATCH /auth/change-password` (fora do contrato).
- O type-check completo (`npm run build`) demora ~2 min nesta máquina por causa dos tipos do Prisma.

## Notas da Fase 3

- Módulo `services` com use cases (`create`, `get`, `update`, `delete`, `list`, `list-provider`) e `ServicePolicy`
  (papel + dono) — testes unitários com `test/fakes/in-memory-service.repository.ts`.
- Value object `Money` (`src/common/domain/money.ts`, cêntimos em `bigint`) — reutilizado na carteira/reservas.
- Paginação no formato do contrato (`src/common/pagination`) e `UuidParamPipe` para `:id`.
- Preço só como string decimal (número JSON → `400`). `sort` ∈ `newest|oldest|price_asc|price_desc|name_asc`.
- Corrigido no teste manual: o `contains` do Prisma não escapa `%`/`_` — escapados em `escapeLikePattern`.
- `ServicesModule` exporta `SERVICE_REPOSITORY` para as reservas lerem serviços ativos.

## Notas da Fase 4

- Módulos `wallet` (top-up, movimentos de saldo + ledger) e `bookings` (reservar, cancelar), com use cases sobre portas.
- Porta `IUnitOfWork` (`src/common/domain/unit-of-work.ts`): o use case recebe os repositórios ligados à transação;
  `PrismaUnitOfWork` usa `prisma.$transaction` (READ COMMITTED explícito); `FakeUnitOfWork` faz rollback em memória.
- Débito condicional com `updateManyAndReturn` (`WHERE balance >= x`, `RETURNING balance` → `balanceAfter`);
  movimentos aplicados por ordem crescente de `userId` (`applyMovementsInLockOrder`) para evitar deadlocks.
- Cancelamento com `UPDATE ... WHERE status = 'CONFIRMED'`; reembolso do preço snapshot; `PROVIDER_INSUFFICIENT_BALANCE` como defesa.
- `npm run test:integration`: concorrência real contra o PostgreSQL (3/10 reservas, 1/10 cancelamentos, 20 top-ups,
  operações cruzadas sem deadlock). Removendo a condição de saldo, o teste falha pelo `CHECK (balance >= 0)`.
- Helpers OpenAPI partilhados em `src/config/openapi.common.ts`.

## Notas da Fase 5

- `GET /bookings` (filtro pelo papel: cliente → `client_id`, prestador → `provider_id`; `status` opcional),
  `GET /bookings/:id` (`404` → `403` se não participa) e `GET /wallet/transactions`, todos paginados com a `meta` do contrato.
- Sem N+1: 3 queries fixas por página de reservas (página + nomes em lote + total), 2 por página de extrato; os planos usam
  `bookings_client_id_created_at_idx` / `wallet_transactions_user_id_created_at_idx`.
- Comentários corrigidos: o Prisma carrega relações em lote (`IN (...)`), não por JOIN (`relationJoins` é *preview*).

## Notas da Fase 6

- Helmet com duas CSP (`src/config/security-headers.ts`): API `default-src 'none'`; `/reference` com nonce por pedido
  e bundle do Scalar com versão fixa (`@scalar/api-reference@1.76.4`). Verificado em Chrome headless sem violações.
- CORS por `CORS_ORIGINS` (omissão: `:5173` web, `:8081` Expo web), `credentials: false`, preflight em cache 10 min;
  pedidos sem `Origin` (app nativa) passam.
- Corpo só JSON, ≤ 16 KB (`BODY_LIMIT`): `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE` (antes: 500 e 400 confusos).
  Ids de pedido atribuídos antes do parser e saneados. Removido o `cookie-parser` (sem cookies → sem CSRF).
- Rate limiting: `AppThrottlerGuard` conta por utilizador (JWT verificado) ou IP; `MONEY_THROTTLE_LIMIT` 10/min em
  reservar, cancelar e top-up; políticas em `src/common/throttle`; `TRUST_PROXY` para o IP real atrás de proxy.
- Logs: `redact` de `Authorization`, cookies, passwords e tokens; sem query string; stack só fora de produção; `LOG_LEVEL`.
  Prisma com `errorFormat: 'minimal'` e sem log de queries.
- Pool `pg` limitado (`DB_POOL_MAX`), `statement_timeout` e `idle_in_transaction_session_timeout`.
- Lint proíbe `$queryRawUnsafe`/`$executeRawUnsafe`. README › Segurança e Desempenho; contrato com 413/415 e limites.
- Para a Fase 7: os testes e2e devem subir `AUTH_THROTTLE_LIMIT`/`MONEY_THROTTLE_LIMIT`; o URL do servidor na spec
  OpenAPI está fixo em `http://localhost:3000` (ajustar na Fase 8).

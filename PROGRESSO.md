# Progresso — Desafio 1 (Backend)

- [x] **Fase 0** — Setup do projeto (NestJS + Prisma + Docker, build/lint/testes verdes, repo público)
- [x] **Fase 1** — Modelo de dados (User, Service, Booking, WalletTransaction, RefreshToken, CHECKs, seed)
- [x] **Fase 2** — Cadastro e autenticação (NIF/e-mail únicos, login por e-mail ou NIF, JWT, RBAC)
- [x] **Fase 3** — Serviços (CRUD do prestador, ownership, soft delete, listagem paginada)
- [ ] **Fase 4** — Carteira e reservas (top-up, reserva e cancelamento atómicos, ledger)
- [ ] **Fase 5** — Histórico (reservas e movimentos de carteira paginados, sem N+1)
- [ ] **Fase 6** — Segurança e desempenho (Helmet, CORS, rate limiting, XSS/CSRF/SQLi, índices)
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

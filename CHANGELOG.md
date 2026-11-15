# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-PT/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado
- Imagem Docker de produção multi-estágio (`Dockerfile.prod`): utilizador sem privilégios, `tini`, `HEALTHCHECK`,
  migrações (`prisma migrate deploy`) no arranque e seed de demonstração opcional (`SEED_DEMO_DATA`).
- `docker-compose.yml` de produção local (só leitura, `no-new-privileges`, segredos obrigatórios) e
  `npm run docker:smoke`: build + arranque + smoke test com `curl`.
- API em contentor opcional no `docker-compose.dev.yml` (`--profile api`).
- Blueprint do Render (`render.yaml`) para deploy com PostgreSQL gerido (Neon).
- Seed em modo `ensure` (idempotente, nunca apaga dados); o modo `reset` é recusado em produção.
- `GET /openapi.json` com o documento OpenAPI; o servidor da spec vem de `APP_URL` (ou `RENDER_EXTERNAL_URL`).

### Alterado
- `GET /health` devolve `{ status: "ok", db: "up", uptime, timestamp }` (formato do contrato) e
  `503 DATABASE_UNAVAILABLE` quando a base de dados não responde.
- `prisma` e `dotenv` passam a dependências de runtime (migrações dentro do contentor).
- Lockfile regenerado para `npm ci` funcionar com o npm do Node 22.

## [0.6.0] — 2026-11-14 — Segurança e desempenho

### Adicionado
- Helmet com CSP estrita para JSON e CSP com nonce para `/reference`; CORS por `CORS_ORIGINS`.
- Corpo só JSON até 16 KB (`413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`).
- Rate limiting por utilizador ou IP: global 100/min, credenciais 5/min, operações com dinheiro 10/min; `TRUST_PROXY`.
- Logs sem credenciais nem tokens (`redact`), pool de ligações limitado e `statement_timeout`.
- Lint que proíbe `$queryRawUnsafe`/`$executeRawUnsafe`.

## [0.5.0] — 2026-11-14 — Histórico

### Adicionado
- `GET /bookings` (filtro por estado, visível ao cliente e ao prestador), `GET /bookings/:id` e
  `GET /wallet/transactions`, paginados e sem N+1.

## [0.4.0] — 2026-11-14 — Carteira e reservas

### Adicionado
- `POST /wallet/top-up` (carregamento simulado), `POST /bookings` e `PATCH /bookings/:id/cancel`.
- Débito condicional (`WHERE balance >= preço`) e cancelamento condicional (`WHERE status = 'CONFIRMED'`) numa
  transação, com bloqueio das contas por ordem crescente de id e ledger `wallet_transactions`.
- Testes de concorrência contra PostgreSQL real (`npm run test:integration`).

## [0.3.0] — 2026-11-13 — Serviços

### Adicionado
- CRUD de serviços do prestador com verificação de dono, soft delete e catálogo paginado com pesquisa,
  filtros de preço e ordenação.

## [0.2.0] — 2026-11-13 — Cadastro e autenticação

### Adicionado
- Registo com nome completo, NIF, e-mail e papel (`CLIENT`/`PROVIDER`); NIF e e-mail únicos.
- Login por e-mail ou NIF, argon2, access token JWT + refresh token rotativo com deteção de reutilização.
- `GET /auth/me`, guards globais de autenticação e papéis, formato de erro único.

## [0.1.0] — 2026-11-13 — Modelo de dados

### Adicionado
- Esquema PostgreSQL (utilizadores, serviços, reservas, movimentos de carteira, refresh tokens) com `DECIMAL(15,2)`,
  índices por consulta e constraints `CHECK` (saldo nunca negativo, preço positivo).
- Seed com dois clientes e dois prestadores.

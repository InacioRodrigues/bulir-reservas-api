# Bulir Reservas API

API RESTful da plataforma de reservas de serviços da Bulir (Desafio 1 — Backend).
Clientes reservam serviços publicados por prestadores; o saldo de ambos é atualizado de forma atómica
e todas as reservas ficam registadas em histórico.

> 🚧 Em desenvolvimento — ver [`PROGRESSO.md`](./PROGRESSO.md). A documentação completa
> (decisões técnicas, segurança, desempenho, deploy e credenciais de demo) chega na Fase 8.

## Stack

- **NestJS 11** + TypeScript, Clean Architecture por módulo (`domain` → `application` → `infrastructure` → `presentation`)
- **PostgreSQL 16** + **Prisma 7** (transações ACID para movimentos de saldo)
- **JWT** (access + refresh token rotativo), **argon2**, RBAC
- **Zod** para validação, **Pino** para logs, **Scalar** para documentação OpenAPI
- **Jest** + Supertest para testes

Âmbito deliberadamente reduzido ao que o desafio pede (sem envio de e-mail, notificações, uploads,
filas ou cache): menos superfície de ataque, menos dependências e um deploy que só precisa de PostgreSQL.

## Como correr (local)

```bash
npm install
cp .env.example .env              # ajustar segredos JWT
npm run docker:dev                # PostgreSQL em localhost:5432
npm run db:generate
npm run db:migrate                # aplica as migrações (inclui os CHECK)
npm run db:seed                   # dados de demonstração
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Documentação (Scalar): `http://localhost:3000/reference`
- Saúde: `GET /api/v1/health`

### Credenciais de demonstração (seed)

Password comum: `Senha@123`. O login aceita e-mail ou NIF (a partir da Fase 2).

| Papel | E-mail | NIF | Notas |
|-------|--------|-----|-------|
| CLIENT | `ana.cliente@bulir.demo` | `004512345LA041` | saldo 50 000.00 Kz |
| CLIENT | `bruno.cliente@bulir.demo` | `006798765LA042` | saldo 0.00 Kz |
| PROVIDER | `carla.prestadora@bulir.demo` | `5417001234` | 3 serviços |
| PROVIDER | `daniel.prestador@bulir.demo` | `5417005678` | 2 serviços |

## Modelo de dados

```
users ──< services                           (prestador publica serviços; soft delete)
users ──< bookings >── services              (cliente reserva; snapshot de preço/nome/prestador)
users ──< wallet_transactions >── bookings   (ledger: cada movimento de saldo)
users ──< refresh_tokens
```

| Tabela | Pontos-chave |
|--------|--------------|
| `users` | `nif` e `email` `UNIQUE`; `balance DECIMAL(15,2) DEFAULT 0` |
| `services` | `price DECIMAL(15,2)`; `deleted_at` para soft delete |
| `bookings` | `price`, `service_name`, `provider_id` copiados no momento da reserva; `status CONFIRMED/CANCELLED` |
| `wallet_transactions` | `amount` com sinal (+ crédito / − débito) e `balance_after`; `UNIQUE (booking_id, type)` |

**Índices** (cada um serve uma consulta concreta da API):

| Índice | Consulta |
|--------|----------|
| `services (provider_id, deleted_at)` | `GET /services/mine` |
| `services (deleted_at, created_at DESC)` | catálogo `GET /services` ordenado por data |
| `bookings (client_id, created_at DESC)` / `(provider_id, created_at DESC)` | histórico de reservas paginado |
| `bookings (service_id)` | FK: evita *seq scan* nas verificações `RESTRICT` e nos JOINs |
| `wallet_transactions (user_id, created_at DESC)` | `GET /wallet/transactions` |
| `refresh_tokens (user_id)` | revogar todas as sessões de um utilizador |

**Constraints `CHECK`** (migração `*_add_check_constraints`): a aplicação valida tudo antes, mas a BD
é a última linha de defesa — mesmo com um bug ou uma corrida, estes estados são impossíveis:
`balance >= 0`, `price > 0` (serviços e reservas), `email = lower(email)`, NIF em maiúsculas e sem espaços,
`client_id <> provider_id`, estado de cancelamento coerente (`CANCELLED` ⇔ `cancelled_at` e `cancelled_by_id` preenchidos),
`amount <> 0` com sinal coerente com o tipo, movimentos de reserva ligados a uma reserva e `balance_after >= 0`.

## Decisões

- **PostgreSQL (SQL) em vez de MongoDB.** Os dados são relacionais (utilizador ↔ serviço ↔ reserva) e o núcleo do
  problema é dinheiro: precisamos de transações ACID multi-linha, `CHECK` e chaves estrangeiras. O MongoDB também tem
  transações (só em *replica set*) mas não tem `CHECK` nem integridade referencial — teríamos de reimplementar isso na aplicação.
- **Dinheiro em `DECIMAL(15,2)`, exposto como string** (`"1500.00"`). `float` não representa 0.10 exatamente;
  um `number` em JSON também não. O mapper converte o `Decimal` do Prisma com `toFixed(2)`, sem passar por `number`.
- **O saldo nunca é escrito por "ler → alterar → gravar".** O `UserRepository.update` só grava campos de perfil;
  o saldo muda apenas por `UPDATE ... SET balance = balance ± x WHERE ...` dentro de transações (Fase 4).
- **Ledger com sinal.** Créditos positivos, débitos negativos → `SUM(amount)` por utilizador tem de ser igual a
  `users.balance` (auditoria simples). O saldo inicial do seed entra também como movimento `TOP_UP`.
- **Snapshots na reserva** (`price`, `service_name`, `provider_id`): editar ou eliminar o serviço não altera o histórico,
  e o reembolso usa o preço efetivamente pago.
- **Serviços com soft delete e FKs `ON DELETE RESTRICT`:** o histórico nunca desaparece em cascata.
- **UUID nativo (`@db.Uuid`)**: 16 bytes em vez de ~36 de texto, índices mais pequenos. Implica validar `:id` como UUID
  na entrada (um texto qualquer daria erro de tipo no Postgres) — feito nas fases seguintes.
- **Sem papel ADMIN:** o enunciado só define Cliente e Prestador; não há CRUD administrativo de utilizadores.

## Scripts úteis

| Comando | O quê |
|---------|-------|
| `npm run build` | Compila para `dist/` |
| `npm run lint:check` | ESLint + Prettier |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes end-to-end |
| `npm run db:seed` | Recria os dados de demonstração |

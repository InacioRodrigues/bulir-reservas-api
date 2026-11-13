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

Password comum: `Senha@123`. O login aceita e-mail **ou** NIF no campo `identifier`.

| Papel | E-mail | NIF | Notas |
|-------|--------|-----|-------|
| CLIENT | `ana.cliente@bulir.demo` | `004512345LA041` | saldo 50 000.00 Kz |
| CLIENT | `bruno.cliente@bulir.demo` | `006798765LA042` | saldo 0.00 Kz |
| PROVIDER | `carla.prestadora@bulir.demo` | `5417001234` | 3 serviços |
| PROVIDER | `daniel.prestador@bulir.demo` | `5417005678` | 2 serviços |

## Autenticação

| Rota | Notas |
|------|-------|
| `POST /auth/register` | `{ fullName, nif, email, password, role }` → `201 { user, accessToken, refreshToken }` |
| `POST /auth/login` | `{ identifier, password }` — `identifier` com `@` é e-mail, senão NIF |
| `POST /auth/refresh` | `{ refreshToken }` → novo par (o antigo deixa de valer) |
| `POST /auth/logout` | `{ refreshToken }` → `204` |
| `GET /auth/me` | perfil + saldo atual |

- **Seguro por omissão:** `JwtAuthGuard` e `RolesGuard` são globais; só `@Public()` abre uma rota e `@Roles('CLIENT')`
  restringe por papel. Regras que dependem dos dados (ex.: "só o dono edita") ficam nos use cases.
- **Access token curto (15 min, sem estado) + refresh token longo (7 dias, com estado na BD).** O access token não
  obriga a ir à BD de sessões em cada pedido; o refresh token pode ser revogado (logout, deteção de roubo).
- **Rotação com deteção de reutilização:** cada refresh token só serve uma vez. A revogação é um
  `UPDATE ... WHERE is_revoked = false` — entre dois pedidos simultâneos com o mesmo token só um vence. Se um token já
  usado reaparecer, alguém o copiou: todas as sessões do utilizador são revogadas.
- **Refresh tokens guardados como SHA-256**, nunca em claro: uma cópia da BD não dá sessões válidas.
- **Erro de login genérico** (`401 INVALID_CREDENTIALS`) e o mesmo custo de hashing quando a conta não existe,
  para não revelar (nem pelo tempo de resposta) que e-mails/NIFs estão registados.
- **Passwords com argon2id**, 8–128 caracteres com pelo menos uma letra e um número (o máximo evita que um corpo
  gigante torne o hashing num vetor de negação de serviço).
- **Rate limiting:** 100 pedidos/min por IP em geral; **5/min** em `login` e `register` (`AUTH_THROTTLE_LIMIT`), 20/min em `refresh`.
- **E-mail/NIF únicos em duas camadas:** verificação prévia (mensagem clara) + `UNIQUE` da BD. Dois registos iguais em
  simultâneo passam ambos a verificação, mas só um `INSERT` vence; o erro `P2002` do outro é traduzido para o mesmo `409`.

## Serviços

| Rota | Quem | Notas |
|------|------|-------|
| `GET /services?page&perPage&search&minPrice&maxPrice&sort` | autenticado | catálogo de serviços ativos, paginado |
| `GET /services/mine?page&perPage` | PROVIDER | serviços ativos do próprio prestador |
| `GET /services/:id` | autenticado | `404` se não existir ou estiver eliminado |
| `POST /services` | PROVIDER | `{ name, description, price }` → `201` |
| `PATCH /services/:id` | PROVIDER dono | alteração parcial → `200` |
| `DELETE /services/:id` | PROVIDER dono | soft delete → `204` |

- **Permissões nos use cases, não no controller.** `@Roles('PROVIDER')` trava cedo quem nunca poderia passar;
  a regra "só o dono altera/elimina" precisa de ler o serviço e vive em `ServicePolicy`, chamada pelos use cases
  (que recebem o utilizador autenticado como `Actor`). Ordem: papel (`403`) → existe (`404`) → é dono (`403`).
- **O prestador associado é sempre o utilizador autenticado.** O corpo passa por zod, que descarta campos
  desconhecidos: enviar `providerId` ou `deletedAt` não tem efeito (sem *mass assignment*).
- **Preço como string decimal** (`"1500"`, `"1500.5"`, `"1500.50"`), > 0 e ≤ 10 000 000.00, no máximo 2 casas;
  devolvido sempre com 2 casas. Um número JSON é rejeitado (`400`): quando chega ao servidor já passou por float.
  As contas e comparações usam o value object `Money` (cêntimos em `bigint`), nunca `number`.
- **Soft delete:** `DELETE` preenche `deleted_at`. O serviço sai do catálogo, do detalhe e de "os meus serviços"
  e deixa de poder ser reservado, mas a linha fica — as reservas antigas apontam para ela (`ON DELETE RESTRICT`)
  e guardam o nome e o preço do momento. Editar um serviço também não altera reservas já feitas.
- **Concorrência:** o `UPDATE` de edição e de eliminação inclui `deleted_at IS NULL` no `WHERE`. Dois `DELETE`
  simultâneos → um `204` e um `404`; editar um serviço que acabou de ser eliminado → `404` (não o "ressuscita").
- **Pesquisa** (`search`, ≤ 100 caracteres) no nome e na descrição, sem distinguir maiúsculas (`ILIKE`, parametrizado).
  `%` e `_` são escapados para serem procurados como texto e não como curingas.
- **Filtros e ordenação:** `minPrice`/`maxPrice` inclusivos (`maxPrice ≥ minPrice`, senão `400`);
  `sort` ∈ `newest` (omissão), `oldest`, `price_asc`, `price_desc`, `name_asc`. Cada ordenação desempata por `id`,
  para a paginação ser estável (nenhum item repetido ou perdido entre páginas).
- **Paginação:** `page` ≥ 1 (≤ 10 000), `perPage` 1–100 (omissão 20); valores fora dos limites dão `400`.
  Página e total são lidos num só round-trip; `meta = { page, perPage, total, totalPages }`.
- **`:id` validado como UUID** antes de chegar à BD (`400 VALIDATION_ERROR` em vez de um erro de tipo do Postgres).

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
  na entrada (um texto qualquer daria erro de tipo no Postgres) — feito com `UuidParamPipe`.
- **NIF: 9 a 14 letras ou dígitos.** Cobre o NIF de pessoa singular (nº do BI, ex. `004512345LA041`) e de pessoa
  coletiva (10 dígitos). Não validamos o dígito de controlo. Ser só alfanumérico garante que nunca contém `@`, o que torna
  o login por e-mail **ou** NIF inequívoco.
- **Normalização** (e-mail `trim` + minúsculas; NIF sem espaços + maiúsculas) aplicada no registo e no login, e reforçada
  por `CHECK` na BD.
- **Catálogo só para utilizadores autenticados**, como no contrato (o enunciado exige autenticação para aceder à API).
- **Ordem `404` antes de `403`** ao editar/eliminar: um id inexistente dá `404` a qualquer prestador; um serviço
  de outro prestador dá `403`. Não esconde nada, porque o catálogo já é visível a todos os utilizadores autenticados.
- **Só dois papéis, `CLIENT` e `PROVIDER`:** são os únicos que o enunciado define; não há gestão de utilizadores por terceiros.

## Scripts úteis

| Comando | O quê |
|---------|-------|
| `npm run build` | Compila para `dist/` |
| `npm run lint:check` | ESLint + Prettier |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes end-to-end |
| `npm run db:seed` | Recria os dados de demonstração |

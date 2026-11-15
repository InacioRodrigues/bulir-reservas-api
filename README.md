# Bulir Reservas API

API RESTful da plataforma de reservas de serviços da Bulir (Desafio 1 — Backend).
Clientes reservam serviços publicados por prestadores; o saldo de ambos é atualizado de forma atómica
e todas as reservas ficam registadas em histórico.

> 🚧 Em desenvolvimento — ver [`PROGRESSO.md`](./PROGRESSO.md). Faltam os testes e2e e a
> checklist final requisito → ficheiro/teste.
>
> **Produção:** `https://<serviço>.onrender.com/api/v1` · documentação em `/reference` (URL definitivo após o
> primeiro deploy — ver [Deploy](#deploy-render--neon)).

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
- Documentação (Scalar): `http://localhost:3000/reference` · OpenAPI em JSON: `http://localhost:3000/openapi.json`
- Saúde: `GET /api/v1/health` (`200` com a BD acessível, `503 DATABASE_UNAVAILABLE` sem ela)

Alternativa sem Node no host: `docker compose -f docker-compose.dev.yml --profile api up -d` (API em modo watch +
PostgreSQL; aplica as migrações no arranque).

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
- **Rate limiting:** **5/min** por IP em `login` e `register` (`AUTH_THROTTLE_LIMIT`), 20/min em `refresh` — ver *Segurança › Rate limiting*.
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

## Carteira e reservas

| Rota | Quem | Notas |
|------|------|-------|
| `POST /wallet/top-up` | CLIENT | `{ amount }` (string, > 0 e ≤ 1 000 000.00) → `200 { balance }`; carregamento simulado |
| `POST /bookings` | CLIENT | `{ serviceId }` → `201 Booking` |
| `PATCH /bookings/:id/cancel` | cliente da reserva ou prestador do serviço | → `200 Booking` com reembolso integral |
| `GET /bookings?page&perPage&status` | autenticado | histórico em que participa, mais recentes primeiro |
| `GET /bookings/:id` | cliente ou prestador da reserva | `404` se não existir, `403` se não participar |
| `GET /wallet/transactions?page&perPage` | autenticado | extrato do próprio (ledger), mais recentes primeiro |

**Reservar** é uma única transação (tudo ou nada):

1. `INSERT` da reserva com *snapshot* do serviço (nome, preço, prestador);
2. débito condicional do cliente — `UPDATE users SET balance = balance - preço WHERE id = $cliente AND balance >= preço RETURNING balance`;
   0 linhas afetadas → `409 INSUFFICIENT_BALANCE` e **rollback** (a reserva do passo 1 desaparece);
3. crédito do prestador — `UPDATE users SET balance = balance + preço WHERE id = $prestador RETURNING balance`;
4. dois movimentos no ledger (`BOOKING_DEBIT` −preço, `BOOKING_CREDIT` +preço) com o `balance_after` devolvido pelo `RETURNING`.

**Cancelar** é outra transação única:

1. `UPDATE bookings SET status = 'CANCELLED', cancelled_at, cancelled_by_id WHERE id = $id AND status = 'CONFIRMED'` —
   0 linhas → `409 BOOKING_ALREADY_CANCELLED`;
2. débito condicional do prestador (`WHERE balance >= preço`) — se falhar, `409 PROVIDER_INSUFFICIENT_BALANCE` e rollback
   (a reserva volta a `CONFIRMED`);
3. crédito do cliente com o **preço pago** (snapshot), não o preço atual do serviço;
4. `REFUND_DEBIT` / `REFUND_CREDIT` no ledger. O `UNIQUE (booking_id, type)` torna fisicamente impossível um segundo reembolso.

Permissões (nos use cases, via `BookingPolicy`): só `CLIENT` reserva (`403`); serviço inexistente ou eliminado → `404`;
cancelar: reserva inexistente → `404`, quem não é o cliente nem o prestador → `403`, já cancelada → `409`.
O corpo só aceita `serviceId` — `price`, `clientId` ou `status` enviados pelo cliente são descartados.

### Porque é seguro sob concorrência

O erro clássico é **verificar e depois agir** (*check-then-act*): ler o saldo, comparar no código e gravar o novo valor.
Dois pedidos leem `5000`, ambos acham que chega, ambos gravam `0` — o cliente pagou uma reserva e recebeu duas
(*lost update*). Aqui a verificação e a escrita são **a mesma instrução SQL**, e o PostgreSQL serializa-as com o lock da linha:

```
Cliente com saldo 5000.00; serviço de 5000.00; dois pedidos em paralelo (READ COMMITTED)

  Pedido A (tx A)                              Pedido B (tx B)
  ───────────────────────────────────────────  ───────────────────────────────────────────
  BEGIN                                        BEGIN
  INSERT booking A                             INSERT booking B
  UPDATE users SET balance = balance - 5000
   WHERE id = C AND balance >= 5000
   → lock da linha C; 5000 >= 5000 → verdadeiro
   → 1 linha, RETURNING 0.00
                                               UPDATE users SET balance = balance - 5000
                                                WHERE id = C AND balance >= 5000
                                                → linha C bloqueada por A: ESPERA
  UPDATE prestador (+5000)
  INSERT ledger (−5000, +5000)
  COMMIT  → liberta o lock
                                                → acorda; o PostgreSQL REAVALIA o WHERE
                                                  sobre a versão confirmada: 0 >= 5000 → falso
                                                → 0 linhas afetadas
                                               throw INSUFFICIENT_BALANCE → ROLLBACK
                                                (booking B nunca existiu)

  Resultado: 1 reserva, saldo 0.00, ledger coerente. Nunca −5000.00.
```

- **Atomicidade:** reserva, dois saldos e dois movimentos de ledger estão na mesma transação — não existe estado
  intermédio visível nem "dinheiro em trânsito" se o processo morrer a meio.
- **Sem lost update:** `balance = balance ± x` é calculado pela BD sobre o valor atual da linha, nunca sobre um valor lido antes.
- **READ COMMITTED chega:** quando o `UPDATE` espera por um lock, o PostgreSQL volta a avaliar o `WHERE` sobre a versão
  confirmada da linha. SERIALIZABLE obrigaria a repetir transações abortadas por conflito, sem ganho de correção aqui.
  Também não é preciso `SELECT ... FOR UPDATE`: o próprio `UPDATE` adquire o lock.
- **Sem deadlocks:** cada transação mexe em dois saldos. Se uma bloqueasse cliente→prestador e outra prestador→cliente,
  cada uma ficaria à espera da outra. `applyMovementsInLockOrder` aplica os movimentos **sempre por ordem crescente de `userId`**,
  em reservas e cancelamentos — quem chega em segundo espera logo na primeira linha.
- **Duplo cancelamento:** o mesmo padrão sobre `bookings.status` (`WHERE status = 'CONFIRMED'`); o perdedor recebe `409`.
- **Defesa em profundidade:** `CHECK (balance >= 0)` e `UNIQUE (booking_id, type)` na BD. Se um bug removesse o `WHERE`
  condicional, a BD rejeitaria o saldo negativo — confirmado ao remover a condição de propósito: o teste de concorrência
  falha com `users_balance_non_negative` em vez de deixar passar.
- **`balance_after` fiável:** vem do `RETURNING` da mesma instrução, e o `created_at` do movimento é a hora da aplicação
  (com o lock já obtido), por isso o extrato de cada utilizador fica pela ordem real dos movimentos.

**Transações sem acoplar os use cases ao Prisma:** os use cases dependem da porta `IUnitOfWork`
(`unitOfWork.run(({ bookings, wallet }) => ...)`), que recebe os repositórios já ligados à transação.
Em produção é `PrismaUnitOfWork` (`prisma.$transaction`); nos testes unitários é `FakeUnitOfWork`, em memória e com rollback real.

**Testes:** `npm test` cobre as regras (saldo igual ao preço, insuficiente, rollback, permissões, snapshot, duplo cancelamento).
`npm run test:integration` corre contra o PostgreSQL de `DATABASE_URL` (cria e apaga os próprios utilizadores):
10 reservas em paralelo com saldo para 3 → exatamente 3 sucessos e saldo 0.00; 10 cancelamentos em paralelo → 1 sucesso
e um só reembolso; 20 carregamentos em paralelo → nenhum perdido; operações cruzadas entre vários clientes e prestadores →
sem deadlocks, sem saldos negativos, `SUM(ledger) = saldo` para todos e o total de dinheiro conservado.

### Histórico

- **Todas as reservas ficam guardadas**, incluindo canceladas e as de serviços já eliminados (soft delete + FKs `RESTRICT`).
  Cada uma mostra serviço, cliente, prestador e o **valor pago** — o nome e o preço vêm do snapshot, por isso editar
  o serviço depois não reescreve o histórico.
- **`GET /bookings` só mostra reservas em que o utilizador participa:** um cliente vê as que fez, um prestador as dos
  seus serviços. O filtro vem do token (papel + id), nunca da query. Filtro opcional `status=CONFIRMED|CANCELLED`.
- **`GET /bookings/:id`:** `404` se não existir, `403` para quem não é cliente nem prestador dessa reserva
  (igual ao cancelamento). Os ids são UUID aleatórios, por isso o `403` não ajuda a enumerar reservas.
- **`GET /wallet/transactions`:** extrato do ledger do próprio utilizador — `amount` com sinal e `balanceAfter`,
  com o `bookingId` quando o movimento vem de uma reserva.
- **Sem N+1 e com índices:** cada lista faz um número fixo de queries, seja qual for o tamanho da página — a página,
  os nomes de cliente/prestador carregados em lote (`WHERE id IN (...)`, uma query por relação) e o total, em paralelo.
  Os filtros seguem exatamente os índices do modelo de dados: `bookings (client_id, created_at DESC)` /
  `(provider_id, created_at DESC)` e `wallet_transactions (user_id, created_at DESC)` — o `ORDER BY created_at DESC`
  sai do próprio índice, sem ordenação em memória. `id` desempata para a paginação ser estável.
  `select` explícito: nunca se leem password hash, NIF ou saldo da outra parte.

## Docker

| Ficheiro | Para quê |
|----------|----------|
| `Dockerfile.prod` | Imagem de produção (a mesma que corre no deploy) |
| `scripts/docker-entrypoint.sh` | Arranque: `prisma migrate deploy` → seed opcional → `exec node dist/main.js` |
| `docker-compose.yml` | Produção local: imagem de produção + PostgreSQL, para validar antes de publicar |
| `scripts/smoke-test.sh` | Constrói, sobe e testa a imagem com `curl` (`npm run docker:smoke`) |
| `Dockerfile.dev` / `docker-compose.dev.yml` | Desenvolvimento (PostgreSQL; API em contentor com `--profile api`) |

**Imagem de produção** (`Dockerfile.prod`), em três estágios:

1. `deps` — `npm ci` com as devDependencies (necessárias para compilar).
2. `builder` — `prisma generate`, `nest build`, compila o seed para JS e faz `npm prune --omit=dev`.
3. `runner` — `node:22-alpine` limpo com só `dist/`, `node_modules` de runtime, `prisma/` (migrações) e o entrypoint.
   O código e as dependências pertencem ao `root`; o processo corre como **`node` (uid 1000)** e não consegue
   alterar o próprio código. `tini` como PID 1 reencaminha o `SIGTERM` e o Nest fecha as ligações à BD
   (paragem em < 1 s). `HEALTHCHECK` chama `GET /api/v1/health`, que só responde `200` com a BD acessível.

No `docker-compose.yml` a API corre ainda com **sistema de ficheiros só de leitura** (`read_only`, `/tmp` em memória)
e `no-new-privileges`; o PostgreSQL não publica porta (só a API o alcança). Os segredos são obrigatórios
(`${VAR:?}`): o compose recusa arrancar sem eles.

```bash
npm run docker:smoke   # build + API + PostgreSQL descartáveis na porta 3100 + testes curl + limpeza
```

O smoke test gera segredos aleatórios, espera pelo healthcheck, confirma que o processo corre como `node` e verifica:
`/health`, `/openapi.json` (com o servidor = `APP_URL`), `/reference`, `401` sem token, login por NIF, catálogo,
reserva `201`, cancelamento `200`, duplo cancelamento `409`, saldo reposto após reembolso e, depois de reiniciar o
contentor, que migrações e seed são idempotentes.

**Migrações no arranque** (e não num passo à parte): o plano gratuito do Render não tem *pre-deploy command*, e
`prisma migrate deploy` é seguro de repetir — só aplica migrações pendentes e serializa instâncias concorrentes com um
*advisory lock* no Postgres. Com um orquestrador que tenha *jobs* (ou o `preDeployCommand` de um plano pago),
basta `RUN_MIGRATIONS=false` e correr `./node_modules/.bin/prisma migrate deploy` nesse passo.

**Seed em produção, de forma segura.** `prisma/seed.ts` tem dois modos:

| `SEED_MODE` | O que faz | Onde |
|-------------|-----------|------|
| `reset` | Apaga **tudo** e recria a demonstração | Omissão em desenvolvimento; **recusado** com `NODE_ENV=production` |
| `ensure` | Cria as 4 contas de demonstração **só se nenhuma existir**; nunca apaga nem altera dados | Omissão em produção |

Com `SEED_DEMO_DATA=true`, o entrypoint corre o modo `ensure` em cada arranque: a primeira vez cria as contas,
as seguintes não fazem nada (e dois arranques em simultâneo resolvem-se pelo `UNIQUE` de e-mail/NIF). Assim a demo
está disponível logo após o deploy sem nunca arriscar apagar dados de quem se registou.

## Deploy (Render + Neon)

Tudo o que é preciso está no repositório: [`render.yaml`](./render.yaml) (Blueprint) descreve um *web service*
Docker construído a partir de `Dockerfile.prod`, com health check em `/api/v1/health`, segredos JWT gerados pelo
Render e auto-deploy a cada push para `main`. A base de dados é um PostgreSQL gerido (Neon, plano gratuito sem
expiração; o PostgreSQL gratuito do Render expira ao fim de 30 dias).

1. **Neon** (neon.tech) → *New project* → região **AWS Europe Central (Frankfurt)**, PostgreSQL 16.
   Copiar a *connection string* **direta** (desligar *Connection pooling*), que termina em `?sslmode=require`.
2. **Render** (render.com) → *New* → *Blueprint* → ligar o GitHub e escolher `bulir-reservas-api`.
   O Render pede as variáveis `sync: false`:
   - `DATABASE_URL` — a connection string do passo 1;
   - `CORS_ORIGINS` — URL da app web publicada (ex.: `https://bulir-reservas-web.vercel.app`); várias separadas por vírgulas.
3. *Apply*. O primeiro deploy constrói a imagem, aplica as migrações, cria as contas de demonstração e só fica
   *live* quando `/api/v1/health` responde `200`.
4. Verificar: `curl https://<serviço>.onrender.com/api/v1/health` e abrir `https://<serviço>.onrender.com/reference`.

Notas:
- **Porquê a ligação direta e não a *pooled*:** as migrações precisam de uma ligação de sessão e o pool da aplicação
  envia `statement_timeout` nos parâmetros de arranque da ligação, que o PgBouncer do Neon (modo transação) não suporta. Com `DB_POOL_MAX=5`, uma
  instância usa no máximo 5 ligações — muito abaixo do limite do Neon.
- **`APP_URL`** (servidor da spec OpenAPI) não precisa de ser definido no Render: sem ele a API usa o
  `RENDER_EXTERNAL_URL` que a plataforma injeta. Com domínio próprio, definir `APP_URL=https://api.exemplo.com`.
- **`TRUST_PROXY=1`:** o Render tem um load balancer à frente da API; sem isto todos os pedidos teriam o IP do proxy
  e partilhariam o mesmo contador de rate limit.
- **Plano gratuito:** o serviço adormece após 15 min sem tráfego e o primeiro pedido seguinte demora ~1 min.
- **Rodar segredos:** no Render, *Environment* → editar `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (ex.: valor de
  `openssl rand -base64 48`) → *Save* (redeploy automático). Todas as sessões existentes deixam de ser válidas.
- **Outra plataforma** (Railway, Fly.io, VPS): é a mesma imagem — basta `DATABASE_URL`, os dois segredos JWT,
  `CORS_ORIGINS`, `TRUST_PROXY` e, opcionalmente, `SEED_DEMO_DATA=true`.

## Segurança

Resumo do que está ativo e porquê. Cada ponto aponta para o ficheiro onde vive.

| Risco | Defesa | Onde |
|-------|--------|------|
| SQL Injection | Só queries parametrizadas (Prisma) + lint que proíbe `$queryRawUnsafe` | `prisma-*.repository.ts`, `eslint.config.mjs` |
| Mass assignment | `zod` descarta campos desconhecidos (`balance`, `role`, `providerId`...) | `application/dto/*.dto.ts` |
| XSS | API só JSON, `nosniff`, CSP `default-src 'none'`, `trim` nas strings | `config/security-headers.ts` |
| CSRF | Sessão em `Authorization: Bearer`, sem cookies; `415` a corpos não-JSON | `common/http/require-json-body.ts` |
| Força bruta / abuso | Rate limiting global, por rota e por utilizador | `common/throttle`, `common/guards/app-throttler.guard.ts` |
| Negação de serviço | Corpo ≤ 16 KB, `perPage ≤ 100`, password ≤ 128, `statement_timeout` | `main.ts`, `pagination.ts`, `prisma.service.ts` |
| Fuga de dados em logs | Redact de `Authorization`, passwords e tokens; sem corpos nem query strings | `config/logger.config.ts` |
| Fuga em erros | `500` genérico; a mensagem real (SQL, tabelas) só vai para o log | `global-exception.filter.ts` |

### SQL Injection

- **Todas as queries passam pela API do Prisma**, que envia os valores como parâmetros (`$1`, `$2`, ...): o texto do
  utilizador nunca é concatenado no SQL, por isso não pode alterar a estrutura da query. A única query manual é
  `$queryRaw` com *template literal* no health check (também parametrizada e sem input).
- **Regra de lint** (`no-restricted-properties`) proíbe `$queryRawUnsafe`/`$executeRawUnsafe`, as variantes que
  aceitam SQL como string — um erro destes falha o CI em vez de chegar a produção.
- **`escapeLikePattern`:** a pesquisa usa `ILIKE '%termo%'`. A parametrização impede injeção de SQL, mas `%` e `_`
  continuam a ser *wildcards* do `LIKE` dentro do parâmetro: pesquisar `%` devolveria tudo e `_` qualquer carácter.
  Escapamos `\`, `%` e `_` para que sejam texto literal. Não é uma falha de segurança grave, é correção de resultados
  (e evita padrões caros como `%_%_%_%`).
- **Validação antes da BD:** `zod` garante tipos e limites (UUID nos `:id`, preços como string decimal, enums), por isso
  a BD nunca recebe um tipo inesperado.

### XSS

A API devolve **só JSON** e nunca gera HTML com dados do utilizador. O XSS acontece no browser, quando um
frontend insere texto como HTML; aqui fazemos a nossa parte e documentamos a dos clientes:
- `Content-Type: application/json` + `X-Content-Type-Options: nosniff`: o browser não "adivinha" que a resposta é HTML.
- **CSP `default-src 'none'; frame-ancestors 'none'`** em todas as respostas da API: mesmo que um valor fosse
  interpretado como página, nenhum script, estilo ou frame carregaria. `X-Frame-Options: DENY` contra clickjacking.
- **Não "limpamos" HTML à entrada:** guardar `<b>` como texto é correto; alterar dados do utilizador (e só para um
  contexto de saída) dá falsos positivos e falsa segurança. A regra é **escapar à saída** — React e React Native já o
  fazem por omissão (nunca usar `dangerouslySetInnerHTML` com estes campos).
- A página `/reference` (Scalar) tem uma CSP própria: scripts só do bundle do CDN com **versão fixa** ou com o
  **nonce** gerado em cada pedido; `connect-src 'self'`. Sem `'unsafe-inline'` em `script-src`.

### CSRF — porque não se aplica (e o que garante isso)

CSRF explora o facto de o browser **anexar cookies automaticamente** a pedidos para o nosso domínio, mesmo quando
vêm de outro site. Esta API não usa cookies: o access token vai no header `Authorization: Bearer`, que só o código
da nossa app (que guardou o token) consegue pôr no pedido. Um site malicioso não conhece o token e o browser não o
envia por ele. Não há credencial "ambiente" para abusar → não há CSRF, e um token anti-CSRF não acrescentaria nada.

O que mantém esta garantia:
- Não há `cookie-parser` nem cookies de sessão; o CORS tem `credentials: false`.
- Os únicos pedidos *cross-site* que o browser envia sem *preflight* são formulários (`x-www-form-urlencoded`,
  `multipart`, `text/plain`) — a API responde `415` a qualquer corpo que não seja `application/json`.
- O CORS só autoriza as origens de `CORS_ORIGINS`; um JSON vindo de outro site exige *preflight* e é recusado.

Se um dia a sessão passar para cookies (ex.: refresh token em cookie `HttpOnly` na app web), passa a ser obrigatório
`SameSite=Strict` (ou `Lax`) + `Secure` e verificar `Origin`.

A contrapartida dos tokens em JavaScript é que um XSS no frontend poderia lê-los — por isso o access token dura 15 min,
o refresh token roda a cada uso e a reutilização revoga todas as sessões (ver *Autenticação*).

### CORS

`CORS_ORIGINS` lista as origens web autorizadas (por omissão `http://localhost:5173` para a app web e
`http://localhost:8081` para o Expo em modo web). Pedidos **sem** `Origin` — a app mobile nativa, curl, outros
servidores — não são afetados: CORS é uma regra do browser, não um controlo de acesso (esse é o JWT). Origens
desconhecidas não recebem `Access-Control-Allow-Origin` e o browser bloqueia a resposta. O resultado do *preflight*
fica em cache 10 min (`Access-Control-Max-Age`) e são expostos `X-Request-Id`, `X-Correlation-Id`, `Retry-After` e
`X-RateLimit-*` para os clientes mostrarem erros úteis.

### Rate limiting

| Rotas | Limite (por minuto) | Contado por |
|-------|---------------------|-------------|
| `POST /auth/login`, `POST /auth/register` | 5 (`AUTH_THROTTLE_LIMIT`) | IP |
| `POST /auth/refresh` | 20 | IP |
| `POST /bookings`, `PATCH /bookings/:id/cancel`, `POST /wallet/top-up` | 10 (`MONEY_THROTTLE_LIMIT`) | utilizador |
| Restantes | 100 (`THROTTLE_LIMIT`) | utilizador ou IP |

- **Por utilizador quando há token válido, senão por IP.** O guard corre antes da autenticação (trava abuso antes de
  qualquer trabalho); verifica a assinatura do JWT em memória (sem BD) para que um `sub` inventado não fuja ao limite.
  Contar só por IP faria clientes atrás do mesmo NAT (empresa, operadora móvel) partilhar o limite.
- **Os contadores são por rota:** 5 tentativas de login não gastam o limite das reservas.
- **`TRUST_PROXY`:** atrás de um load balancer o IP do socket é o do proxy; sem confiar no `X-Forwarded-For` todos os
  clientes partilhariam um contador. Configura-se o número de saltos (nunca `true`, que deixaria o cliente forjar o IP).
- `429 TOO_MANY_REQUESTS` com `Retry-After`. O armazenamento é em memória: suficiente para uma instância; com várias
  instâncias o passo seguinte é um *storage* partilhado para o throttler.

### Validação e mass assignment

Todos os corpos, queries e `:id` passam por `zod` antes do use case. Os schemas são `z.object` (não `passthrough`):
campos desconhecidos são **descartados**, por isso enviar `balance` no registo, `providerId` ao criar um serviço ou
`price`/`clientId` numa reserva não tem efeito — o prestador é sempre o utilizador do token e o preço vem sempre da BD. Strings com `trim`,
tamanhos máximos em tudo e `perPage ≤ 100`.

### Headers, corpo e erros

- **Helmet:** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS, sem `X-Powered-By`.
- **Corpo:** só JSON, máximo 16 KB (`BODY_LIMIT`) → `413 PAYLOAD_TOO_LARGE`; outro `Content-Type` → `415`.
  O maior corpo legítimo (serviço com descrição de 1000 caracteres) tem poucos KB.
- **Erros:** sempre o formato do contrato. Um erro inesperado devolve `500` genérico com `correlationId`; a mensagem
  real (que pode conter SQL ou nomes de tabelas) só vai para o log. O Prisma usa `errorFormat: 'minimal'` para que
  os argumentos da query (ex.: hash da password) nunca apareçam numa mensagem de erro.
- **`X-Request-Id`/`X-Correlation-Id`** do cliente só são aceites num formato curto e seguro; caso contrário gera-se
  um UUID (evita injetar texto arbitrário nos logs e nas respostas).

### Logs

Pino em JSON (legível com `pino-pretty` em desenvolvimento). Cada pedido regista método, caminho **sem query string**,
IP real, user-agent, estado e tempo — nunca headers nem corpos. Como defesa extra, o `redact` apaga `Authorization`,
cookies, `password`, `passwordHash`, `accessToken`, `refreshToken` e `token` em qualquer objeto registado (até dois
níveis). Stack traces só fora de produção; em produção chega o `correlationId` para cruzar resposta e log.

### Segredos

`.env` fora do git; a aplicação **não arranca** se a configuração for inválida (validação `zod` no boot: segredos JWT,
`DATABASE_URL`, `CORS_ORIGINS` com origens bem formadas). Segredos de access e refresh diferentes.
Em produção os segredos JWT são gerados pelo Render (`generateValue` no `render.yaml`) e nunca passam pelo git;
o `docker-compose.yml` recusa arrancar sem eles e a imagem não contém nenhum `.env` (excluído no `.dockerignore`).

## Desempenho

- **Índices desenhados para as queries** (ver *Modelo de dados*): cada listagem filtra e ordena pela mesma chave do
  índice (`(client_id, created_at DESC)`, ...), por isso a paginação lê só as linhas da página, sem ordenação em memória.
- **Sem N+1:** número fixo de queries por página (página + relações em lote + total, em paralelo).
- **Transações curtas:** a reserva faz só *updates* condicionais e *inserts* dentro da transação — nada de leituras
  prévias com `SELECT ... FOR UPDATE` nem chamadas externas — e bloqueia linhas sempre pela mesma ordem (sem deadlocks).
  O lock de uma linha de saldo dura milissegundos.
- **Pool de ligações limitado** (`DB_POOL_MAX`, 10 por omissão): protege o Postgres quando há várias instâncias;
  sem ligação livre em 5 s o pedido falha depressa em vez de ficar pendurado.
- **`statement_timeout` (10 s) e `idle_in_transaction_session_timeout`:** nenhuma query ou transação esquecida
  segura locks de saldo indefinidamente.
- **Respostas comprimidas** (`compression`) e **`select` explícito** nas listagens de histórico (só as colunas que a
  resposta usa).
- **Paginação obrigatória** com `perPage ≤ 100`: nenhuma rota devolve uma tabela inteira.
- **Preflight CORS em cache** 10 min e **logs sem queries do Prisma** (menos I/O por pedido).
- **Rate limiting nas operações com dinheiro**: cada uma abre uma transação; um script em ciclo não consegue
  monopolizar o pool de ligações.

**Limites conhecidos (e o passo seguinte):** a pesquisa `ILIKE '%termo%'` no catálogo não usa índice B-tree — com
dezenas de milhares de serviços, um índice GIN `pg_trgm` em `name`/`description` resolve. A ordenação por preço do
catálogo ordena o conjunto filtrado; um índice `(deleted_at, price)` ajudaria se esse fosse o caso comum. O
`COUNT(*)` da paginação cresce com a tabela; acima de centenas de milhares de linhas trocaria por paginação por cursor.
O rate limiting em memória serve uma instância; com várias, *storage* partilhado.

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
  o saldo muda apenas por `UPDATE ... SET balance = balance ± x WHERE ...` dentro de transações (ver *Carteira e reservas*).
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
- **O prestador recebe no momento da reserva** (crédito imediato, como no contrato). O cancelamento devolve o valor a
  partir do saldo do prestador; como hoje não há levantamentos, esse saldo inclui sempre o valor da reserva e o
  `409 PROVIDER_INSUFFICIENT_BALANCE` é uma defesa para quando existirem (nunca se cria saldo negativo para reembolsar).
- **Cancelamento sem limite de prazo e por qualquer das partes:** o enunciado não define janela de cancelamento;
  ambas as partes podem cancelar uma reserva `CONFIRMED` e o reembolso é sempre integral.
- **Carregamento de saldo simulado** (só `CLIENT`, ≤ 1 000 000.00 por operação): não há gateway de pagamento no âmbito
  do desafio; cada carregamento fica no ledger como `TOP_UP`.
- **Reserva vs. eliminação simultânea do serviço:** a reserva usa o serviço lido no início do pedido. Se o prestador o
  eliminar nesse mesmo instante, a reserva pode concluir-se com os dados do snapshot — equivale a ter chegado um
  milissegundo antes. O histórico e o reembolso continuam corretos porque usam o snapshot.
- **Só dois papéis, `CLIENT` e `PROVIDER`:** são os únicos que o enunciado define; não há gestão de utilizadores por terceiros.

## Scripts úteis

| Comando | O quê |
|---------|-------|
| `npm run build` | Compila para `dist/` |
| `npm run lint:check` | ESLint + Prettier |
| `npm test` | Testes unitários |
| `npm run test:integration` | Concorrência contra o PostgreSQL de `DATABASE_URL` |
| `npm run test:e2e` | Testes end-to-end |
| `npm run db:seed` | Recria os dados de demonstração (`SEED_MODE=ensure` para não apagar nada) |
| `npm run docker:smoke` | Build da imagem de produção + smoke test com `curl` |
| `npm run docker:prod` | Imagem de produção + PostgreSQL locais (exige `POSTGRES_PASSWORD` e segredos JWT) |

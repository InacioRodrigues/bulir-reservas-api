# Progresso — Desafio 1 (Backend)

- [x] **Fase 0** — Setup do projeto (NestJS + Prisma + Docker, build/lint/testes verdes, repo público)
- [x] **Fase 1** — Modelo de dados (User, Service, Booking, WalletTransaction, RefreshToken, CHECKs, seed)
- [ ] **Fase 2** — Cadastro e autenticação (NIF/e-mail únicos, login por e-mail ou NIF, JWT, RBAC)
- [ ] **Fase 3** — Serviços (CRUD do prestador, ownership, soft delete, listagem paginada)
- [ ] **Fase 4** — Carteira e reservas (top-up, reserva e cancelamento atómicos, ledger)
- [ ] **Fase 5** — Histórico (reservas e movimentos de carteira paginados, sem N+1)
- [ ] **Fase 6** — Segurança e desempenho (Helmet, CORS, rate limiting, XSS/CSRF/SQLi, índices)
- [ ] **Fase 7** — Testes (unit + e2e com Postgres real, teste de concorrência, CI)
- [ ] **Fase 8** — Docker, documentação e deploy
- [ ] **Fase 9** — Revisão final (checklist requisito → ficheiro/teste)

## Notas da Fase 0

- Sem endpoints `verify-email`, `forgot-password` e `reset-password` (não há envio de e-mail no âmbito do desafio).
- Logout apaga a sessão do refresh token na BD (sem Redis).

## Notas da Fase 1

- Migrações: `20261113200621_init` (tabelas, enums, índices) e `20261113200629_add_check_constraints` (CHECKs manuais).
- `wallet_transactions.amount` tem sinal (+ crédito / − débito) — ver README › Decisões.
- Domínio `User` alinhado (fullName, nif, role CLIENT/PROVIDER, balance só de leitura); removido o CRUD admin de `/users`.
- Corrigido `tsconfig.build.json` (o build compilava `prisma/` e o entrypoint ia para `dist/src/main`).
- Pendente para a Fase 2: normalização de e-mail/NIF, verificação de NIF duplicado + tratamento de `P2002`,
  login por `identifier`, erros com `code` do contrato, resposta de register/login com `user`.
- Pendente para a Fase 7: `test/app.e2e-spec.ts` não compila (`import * as request from 'supertest'`).

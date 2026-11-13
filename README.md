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
npm run db:migrate
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Documentação (Scalar): `http://localhost:3000/reference`
- Saúde: `GET /api/v1/health`

## Scripts úteis

| Comando | O quê |
|---------|-------|
| `npm run build` | Compila para `dist/` |
| `npm run lint:check` | ESLint + Prettier |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes end-to-end |

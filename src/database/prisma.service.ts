import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      // Pool de ligações: cada pedido pede uma emprestada e devolve-a. Um
      // teto explícito protege o Postgres (planos geridos têm ~20-100 ligações
      // no total) quando há várias instâncias da API.
      max: Number(process.env.DB_POOL_MAX ?? 10),
      // Sem ligação livre em 5 s → erro rápido em vez de pedidos pendurados.
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      // Nenhuma query (nem transação esquecida a meio) segura linhas de saldo
      // bloqueadas indefinidamente.
      statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 10_000),
      idle_in_transaction_session_timeout: 10_000,
    });

    super({
      adapter,
      // Mensagens de erro sem o excerto da invocação: o formato por omissão
      // pode incluir os argumentos da query (ex.: o hash da password) e essa
      // mensagem acaba nos logs através do filtro de exceções.
      errorFormat: 'minimal',
      // Sem log de queries nem de `info`: ruído e custo em cada pedido.
      log: [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL');
  }
}

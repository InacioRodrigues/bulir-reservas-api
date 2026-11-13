import { Prisma } from '@prisma/client';
import { IUnitOfWork } from '@common/domain/unit-of-work';
import { PrismaService } from './prisma.service';

/** Cliente Prisma dentro de uma transação (ou o cliente normal, fora dela). */
export type PrismaDb = Prisma.TransactionClient;

/**
 * Implementação de `IUnitOfWork` com uma transação interativa do Prisma
 * (`BEGIN ... COMMIT` numa só ligação do pool).
 *
 * `bind` cria os repositórios a usar dentro da transação, todos sobre o
 * mesmo `tx` — é isso que garante que as escritas são atómicas.
 *
 * Nível de isolamento: READ COMMITTED (o nível por omissão do PostgreSQL), escrito aqui
 * de forma explícita. Os movimentos de saldo usam `UPDATE ... WHERE` condicional:
 * se dois pedidos tentam alterar a mesma linha, o segundo espera pelo lock do
 * primeiro e o PostgreSQL volta a avaliar o `WHERE` sobre a versão já
 * confirmada. Com SERIALIZABLE teríamos de repetir transações abortadas por
 * conflito de serialização, sem ganho de correção para este caso.
 */
export class PrismaUnitOfWork<TRepos> implements IUnitOfWork<TRepos> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bind: (tx: PrismaDb) => TRepos,
  ) {}

  run<T>(work: (repos: TRepos) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(this.bind(tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      // Tempo máximo à espera de uma ligação livre no pool / de execução.
      maxWait: 5_000,
      timeout: 10_000,
    });
  }
}

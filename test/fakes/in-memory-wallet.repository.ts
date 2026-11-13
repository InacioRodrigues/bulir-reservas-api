import { randomUUID } from 'node:crypto';
import { Money } from '@common/domain/money';
import {
  Page,
  PaginationQuery,
  pageOffset,
} from '@common/pagination/pagination';
import { WalletTransaction } from '@modules/wallet/domain/entities/wallet-transaction.entity';
import {
  IWalletRepository,
  WalletMovement,
} from '@modules/wallet/domain/repositories/wallet.repository.interface';
import { UndoLog } from './fake-unit-of-work';

/** `Money.parse` só aceita valores sem sinal; o ledger guarda débitos negativos. */
export const parseSigned = (amount: string): Money =>
  amount.startsWith('-')
    ? Money.parse(amount.slice(1)).negated()
    : Money.parse(amount);

/** "Tabelas" partilhadas por todas as instâncias (como a BD). */
export class InMemoryWalletStore {
  /** Saldo em cêntimos por utilizador (`users.balance`). */
  readonly balances = new Map<string, bigint>();
  /** `wallet_transactions`. */
  readonly ledger: WalletTransaction[] = [];
}

/**
 * Carteira em memória com o mesmo comportamento observável do Prisma: o
 * débito é condicional (saldo nunca negativo), cada movimento entra no ledger
 * com `balanceAfter` e o `UNIQUE (booking_id, type)` é respeitado.
 * Cada `applyMovement` corre sem `await` intermédio → é atómico no event loop,
 * como o `UPDATE ... WHERE` é na BD.
 */
export class InMemoryWalletRepository implements IWalletRepository {
  constructor(
    readonly store = new InMemoryWalletStore(),
    private readonly undo?: UndoLog,
  ) {}

  /** O mesmo "banco de dados", visto de dentro de uma transação. */
  withUndo(undo: UndoLog): InMemoryWalletRepository {
    return new InMemoryWalletRepository(this.store, undo);
  }

  openAccount(userId: string): void {
    this.store.balances.set(userId, 0n);
  }

  /** Força um saldo sem passar pelo ledger (só para cenários de teste). */
  setBalance(userId: string, amount: string): void {
    this.store.balances.set(userId, Money.parse(amount).inCents);
  }

  balanceOf(userId: string): string {
    return Money.fromCents(this.store.balances.get(userId) ?? 0n).toString();
  }

  /** `SUM(amount)` do ledger de um utilizador. */
  ledgerSumOf(userId: string): string {
    return this.entriesOf(userId)
      .reduce((sum, t) => sum.plus(parseSigned(t.amount)), Money.zero())
      .toString();
  }

  entriesOf(userId: string): WalletTransaction[] {
    return this.store.ledger.filter((t) => t.userId === userId);
  }

  applyMovement(movement: WalletMovement): Promise<WalletTransaction | null> {
    const { balances, ledger } = this.store;
    const current = balances.get(movement.userId);
    if (current === undefined) return Promise.resolve(null);

    const next = current + movement.amount.inCents;
    if (next < 0n) return Promise.resolve(null);

    if (
      movement.bookingId &&
      ledger.some(
        (t) => t.bookingId === movement.bookingId && t.type === movement.type,
      )
    ) {
      return Promise.reject(
        new Error('Unique constraint failed on (booking_id, type)'),
      );
    }

    balances.set(movement.userId, next);
    const transaction: WalletTransaction = {
      id: randomUUID(),
      userId: movement.userId,
      bookingId: movement.bookingId ?? null,
      type: movement.type,
      amount: movement.amount.toString(),
      balanceAfter: Money.fromCents(next).toString(),
      createdAt: new Date(),
    };
    ledger.push(transaction);

    this.undo?.push(() => {
      balances.set(
        movement.userId,
        (balances.get(movement.userId) ?? 0n) - movement.amount.inCents,
      );
      ledger.splice(ledger.indexOf(transaction), 1);
    });
    return Promise.resolve({ ...transaction });
  }

  findTransactions(
    userId: string,
    query: PaginationQuery,
  ): Promise<Page<WalletTransaction>> {
    // Mais recentes primeiro; a ordem de inserção desempata (datas iguais).
    const mine = this.entriesOf(userId)
      .map((t, index) => ({ t, index }))
      .sort(
        (a, b) =>
          b.t.createdAt.getTime() - a.t.createdAt.getTime() ||
          b.index - a.index,
      )
      .map(({ t }) => ({ ...t }));
    const offset = pageOffset(query);
    return Promise.resolve({
      items: mine.slice(offset, offset + query.perPage),
      total: mine.length,
      page: query.page,
      perPage: query.perPage,
    });
  }
}

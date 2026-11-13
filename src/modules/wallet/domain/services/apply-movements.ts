import { BaseException } from '@common/exceptions';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import {
  IWalletRepository,
  WalletMovement,
} from '../repositories/wallet.repository.interface';

export interface PlannedMovement extends WalletMovement {
  /** Erro a lançar se o débito não puder ser aplicado (saldo insuficiente). */
  onRejected: () => BaseException;
}

/**
 * Aplica vários movimentos de saldo dentro da mesma transação, **sempre por
 * ordem crescente de `userId`**.
 *
 * Porquê a ordem? Cada `UPDATE` bloqueia a linha do utilizador até ao fim da
 * transação. Se a transação A bloqueasse cliente→prestador e a B
 * prestador→cliente, cada uma ficaria à espera da outra (deadlock). Com uma
 * ordem global única, quem chega em segundo espera na primeira linha e nunca
 * fica com um lock de que o outro precisa.
 *
 * Se um movimento for rejeitado, lança o erro desse movimento: a transação é
 * revertida e os movimentos já aplicados desaparecem com ela.
 */
export async function applyMovementsInLockOrder(
  wallet: IWalletRepository,
  movements: PlannedMovement[],
): Promise<WalletTransaction[]> {
  const ordered = [...movements].sort((a, b) =>
    a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0,
  );

  const applied: WalletTransaction[] = [];
  for (const { onRejected, ...movement } of ordered) {
    const transaction = await wallet.applyMovement(movement);
    if (!transaction) {
      throw onRejected();
    }
    applied.push(transaction);
  }
  return applied;
}

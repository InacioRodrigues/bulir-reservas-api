import { PrismaDb } from '@database/prisma-unit-of-work';
import { WalletTransaction } from '../../domain/entities/wallet-transaction.entity';
import {
  IWalletRepository,
  WalletMovement,
} from '../../domain/repositories/wallet.repository.interface';
import {
  WalletTransactionMapper,
  walletTransactionSelect,
} from '../prisma/wallet-transaction.mapper';

/**
 * Carteira sobre PostgreSQL. Recebe o cliente Prisma a usar: dentro de uma
 * transação é o `tx` (ver `PrismaUnitOfWork`), fora dela o `PrismaService`.
 */
export class PrismaWalletRepository implements IWalletRepository {
  constructor(private readonly db: PrismaDb) {}

  async applyMovement(
    movement: WalletMovement,
  ): Promise<WalletTransaction | null> {
    const amount = movement.amount.toString();

    // Uma única instrução SQL, atómica:
    //   UPDATE users SET balance = balance + $amount
    //   WHERE id = $id [AND balance >= $debito]
    //   RETURNING balance
    // O incremento é calculado pela BD sobre o valor atual da linha (não
    // sobre um saldo lido antes), e a condição de saldo é avaliada depois de
    // obtido o lock da linha. Sem linhas afetadas = débito recusado.
    const updated = await this.db.user.updateManyAndReturn({
      where: {
        id: movement.userId,
        ...(movement.amount.isNegative() && {
          balance: { gte: movement.amount.abs().toString() },
        }),
      },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });
    if (updated.length !== 1) {
      return null;
    }

    const saved = await this.db.walletTransaction.create({
      data: {
        userId: movement.userId,
        bookingId: movement.bookingId ?? null,
        type: movement.type,
        amount,
        balanceAfter: updated[0].balance,
        // Data da aplicação, não do início da transação: o lock da linha só é
        // libertado no COMMIT, por isso movimentos do mesmo utilizador ficam
        // com datas pela mesma ordem em que alteraram o saldo.
        createdAt: new Date(),
      },
      select: walletTransactionSelect,
    });
    return WalletTransactionMapper.toDomain(saved);
  }
}

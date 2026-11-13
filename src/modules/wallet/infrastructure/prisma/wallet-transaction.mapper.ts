import { Prisma } from '@prisma/client';
import { WalletTransaction } from '../../domain/entities/wallet-transaction.entity';

/** Colunas públicas de um movimento (sem JOINs: o extrato é do próprio). */
export const walletTransactionSelect = {
  id: true,
  userId: true,
  bookingId: true,
  type: true,
  amount: true,
  balanceAfter: true,
  createdAt: true,
} satisfies Prisma.WalletTransactionSelect;

export type WalletTransactionRow = Prisma.WalletTransactionGetPayload<{
  select: typeof walletTransactionSelect;
}>;

export class WalletTransactionMapper {
  static toDomain(raw: WalletTransactionRow): WalletTransaction {
    return {
      id: raw.id,
      userId: raw.userId,
      bookingId: raw.bookingId,
      type: raw.type,
      // Decimal → string com 2 casas, sem passar por `number`.
      amount: raw.amount.toFixed(2),
      balanceAfter: raw.balanceAfter.toFixed(2),
      createdAt: raw.createdAt,
    };
  }
}

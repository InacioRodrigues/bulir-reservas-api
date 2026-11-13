import {
  WalletTransaction,
  WalletTransactionType,
} from '../../domain/entities/wallet-transaction.entity';

/** Forma pública de um movimento (ver `Transaction` em CONTRATO-API.md). */
export interface WalletTransactionResponse {
  id: string;
  type: WalletTransactionType;
  amount: string;
  balanceAfter: string;
  bookingId: string | null;
  createdAt: string;
}

export class WalletTransactionPresenter {
  static toResponse(transaction: WalletTransaction): WalletTransactionResponse {
    return {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter,
      bookingId: transaction.bookingId,
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}

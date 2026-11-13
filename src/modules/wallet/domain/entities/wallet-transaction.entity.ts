/**
 * Tipos de movimento no ledger. Os valores coincidem com o enum da BD.
 * Créditos (TOP_UP, BOOKING_CREDIT, REFUND_CREDIT) têm `amount` positivo;
 * débitos (BOOKING_DEBIT, REFUND_DEBIT) têm `amount` negativo.
 */
export const WalletTransactionType = {
  TOP_UP: 'TOP_UP',
  BOOKING_DEBIT: 'BOOKING_DEBIT',
  BOOKING_CREDIT: 'BOOKING_CREDIT',
  REFUND_CREDIT: 'REFUND_CREDIT',
  REFUND_DEBIT: 'REFUND_DEBIT',
} as const;

export type WalletTransactionType =
  (typeof WalletTransactionType)[keyof typeof WalletTransactionType];

/**
 * Um movimento de saldo já registado (linha imutável do ledger).
 * Valores em string decimal com 2 casas, nunca float.
 */
export interface WalletTransaction {
  id: string;
  userId: string;
  bookingId: string | null;
  type: WalletTransactionType;
  /** Com sinal: "+5000.00" num crédito, "-5000.00" num débito. */
  amount: string;
  /** Saldo do utilizador logo a seguir a este movimento. */
  balanceAfter: string;
  createdAt: Date;
}

import { Money } from '@common/domain/money';
import {
  WalletTransaction,
  WalletTransactionType,
} from '../entities/wallet-transaction.entity';

/** Um movimento de saldo a aplicar: quem, quanto (com sinal) e porquê. */
export interface WalletMovement {
  userId: string;
  type: WalletTransactionType;
  /** Positivo = crédito; negativo = débito. Nunca zero. */
  amount: Money;
  /** Obrigatório em movimentos de reserva; ausente no carregamento. */
  bookingId?: string;
}

export interface IWalletRepository {
  /**
   * Aplica o movimento ao saldo **e** regista-o no ledger (com o saldo
   * resultante em `balanceAfter`). Tem de correr dentro de uma transação
   * (`IUnitOfWork`) para as duas escritas serem atómicas.
   *
   * Um débito só é aplicado se houver saldo, numa única instrução:
   * `UPDATE users SET balance = balance - x WHERE id = ? AND balance >= x`.
   * Nunca "ler saldo → comparar → gravar", que perde atualizações concorrentes.
   *
   * @returns o movimento registado, ou `null` se não foi aplicado (saldo
   * insuficiente ou conta inexistente) — nesse caso nada foi escrito.
   */
  applyMovement(movement: WalletMovement): Promise<WalletTransaction | null>;
}

export const WALLET_REPOSITORY = Symbol('IWalletRepository');

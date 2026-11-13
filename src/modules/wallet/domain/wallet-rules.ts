import { Money } from '@common/domain/money';

/**
 * Limites do carregamento de saldo (simulado). O máximo por operação evita
 * erros de digitação com zeros a mais e mantém o saldo longe do limite do
 * `DECIMAL(15,2)`.
 */
export const WALLET_RULES = {
  topUp: {
    /** Exclusivo: tem de ser > 0. */
    min: Money.zero(),
    /** Inclusivo. */
    max: Money.parse('1000000.00'),
  },
} as const;

export function isTopUpInRange(amount: Money): boolean {
  return (
    amount.greaterThan(WALLET_RULES.topUp.min) &&
    amount.lessThanOrEqual(WALLET_RULES.topUp.max)
  );
}

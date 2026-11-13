import { Money } from '@common/domain/money';

/**
 * Regras de um serviço, partilhadas pela validação HTTP (DTO) e pela
 * entidade — uma só fonte de verdade para os limites.
 */
export const SERVICE_RULES = {
  name: { min: 3, max: 100 },
  description: { min: 10, max: 1000 },
  price: {
    /** Exclusivo: o preço tem de ser > 0 (também `CHECK (price > 0)` na BD). */
    min: Money.zero(),
    /** Inclusivo. */
    max: Money.parse('10000000.00'),
  },
} as const;

/** `true` se o preço respeita 0 < preço ≤ 10 000 000.00. */
export function isPriceInRange(price: Money): boolean {
  return (
    price.greaterThan(SERVICE_RULES.price.min) &&
    price.lessThanOrEqual(SERVICE_RULES.price.max)
  );
}

import { ValidationException } from '@common/exceptions';

/**
 * Formato aceite para valores monetários: até 13 dígitos inteiros e até 2
 * casas decimais — exatamente o que cabe em `DECIMAL(15,2)`. Sem sinal,
 * sem separador de milhares, sem notação científica.
 */
const MONEY_PATTERN = /^(\d{1,13})(?:\.(\d{1,2}))?$/;

/** 400 `VALIDATION_ERROR` para um valor monetário mal formado. */
export class InvalidMoneyError extends ValidationException {
  constructor(field: string, message: string) {
    super([{ field, message }], message);
  }
}

/**
 * Valor monetário exato em Kwanzas, guardado internamente em cêntimos
 * (`bigint`).
 *
 * Porquê não `number`? Um `number` é um float IEEE-754: `0.1 + 0.2` dá
 * `0.30000000000000004`. Com cêntimos inteiros as somas, subtrações e
 * comparações são exatas. O valor entra e sai sempre como string decimal
 * (`"1500.00"`), tal como na API e no `DECIMAL(15,2)` da BD — nunca passa
 * por float em nenhum ponto.
 */
export class Money {
  private constructor(private readonly cents: bigint) {}

  static readonly PATTERN = MONEY_PATTERN;

  static zero(): Money {
    return new Money(0n);
  }

  static fromCents(cents: bigint): Money {
    return new Money(cents);
  }

  /** Aceita `"1500"`, `"1500.5"` ou `"1500.50"`; rejeita o resto. */
  static isValid(value: string): boolean {
    return MONEY_PATTERN.test(value.trim());
  }

  /**
   * Converte uma string decimal em `Money`.
   * @throws InvalidMoneyError se o formato não for válido.
   */
  static parse(value: string, field = 'amount'): Money {
    const match = MONEY_PATTERN.exec(value.trim());
    if (!match) {
      throw new InvalidMoneyError(
        field,
        'Valor monetário inválido: use uma string decimal com até 2 casas, ex.: "1500.00"',
      );
    }
    const [, integerPart, fractionPart = ''] = match;
    const cents =
      BigInt(integerPart) * 100n + BigInt(fractionPart.padEnd(2, '0'));
    return new Money(cents);
  }

  get inCents(): bigint {
    return this.cents;
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  isPositive(): boolean {
    return this.cents > 0n;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  greaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.cents >= other.cents;
  }

  lessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  lessThanOrEqual(other: Money): boolean {
    return this.cents <= other.cents;
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  minus(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  /** Simétrico: um débito no ledger é o preço com sinal negativo. */
  negated(): Money {
    return new Money(-this.cents);
  }

  isNegative(): boolean {
    return this.cents < 0n;
  }

  /** Valor absoluto (ex.: o montante a exigir num débito condicional). */
  abs(): Money {
    return this.cents < 0n ? this.negated() : this;
  }

  /** Forma canónica com 2 casas: `"1500.00"`, `"-20.05"`. */
  toString(): string {
    const negative = this.cents < 0n;
    const abs = negative ? -this.cents : this.cents;
    const integerPart = abs / 100n;
    const fractionPart = (abs % 100n).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${integerPart}.${fractionPart}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

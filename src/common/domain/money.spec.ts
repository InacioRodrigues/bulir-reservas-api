import { InvalidMoneyError, Money } from './money';

describe('Money', () => {
  it.each([
    ['1500', '1500.00'],
    ['1500.5', '1500.50'],
    ['1500.05', '1500.05'],
    ['0.01', '0.01'],
    ['007.10', '7.10'],
    [' 12.30 ', '12.30'],
    ['9999999999999.99', '9999999999999.99'],
  ])('normaliza "%s" para "%s"', (input, expected) => {
    expect(Money.parse(input).toString()).toBe(expected);
  });

  it.each([
    '',
    'abc',
    '-10.00',
    '+10',
    '1.234',
    '1.',
    '.5',
    '1,50',
    '1 000.00',
    '1e3',
    'NaN',
    '10000000000000.00',
  ])('rejeita "%s" com 400 VALIDATION_ERROR', (input) => {
    expect(() => Money.parse(input, 'price')).toThrow(InvalidMoneyError);
    try {
      Money.parse(input, 'price');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'price' }],
      });
      expect((error as InvalidMoneyError).getStatus()).toBe(400);
    }
  });

  it('soma e subtrai sem erros de vírgula flutuante (0.10 + 0.20 = 0.30)', () => {
    const total = Money.parse('0.10').plus(Money.parse('0.20'));
    expect(total.toString()).toBe('0.30');
    expect(total.equals(Money.parse('0.3'))).toBe(true);
    expect(Money.parse('10.00').minus(Money.parse('20.05')).toString()).toBe(
      '-10.05',
    );
  });

  it('compara valores (saldo igual ao preço é suficiente)', () => {
    const price = Money.parse('5000.00');
    expect(Money.parse('5000').greaterThanOrEqual(price)).toBe(true);
    expect(Money.parse('4999.99').greaterThanOrEqual(price)).toBe(false);
    expect(Money.parse('4999.99').lessThan(price)).toBe(true);
    expect(price.greaterThan(Money.zero())).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.parse('0.00').isPositive()).toBe(false);
  });

  it('serializa para JSON como string', () => {
    expect(JSON.stringify({ price: Money.parse('12') })).toBe(
      '{"price":"12.00"}',
    );
  });

  it('negated/abs/isNegative tratam débitos com sinal sem perder precisão', () => {
    const price = Money.parse('1500.05');
    const debit = price.negated();

    expect(debit.toString()).toBe('-1500.05');
    expect(debit.isNegative()).toBe(true);
    expect(debit.abs().equals(price)).toBe(true);
    expect(price.abs().equals(price)).toBe(true);
    expect(price.plus(debit).isZero()).toBe(true);
  });
});

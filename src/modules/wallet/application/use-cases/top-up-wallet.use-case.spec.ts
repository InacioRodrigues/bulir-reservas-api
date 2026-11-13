import { createBookingsTestKit } from '@test/fakes/bookings-test-kit';
import { FakeUnitOfWork } from '@test/fakes/fake-unit-of-work';
import { WalletTransactionScope } from '../../domain/ports/wallet-unit-of-work';
import { TopUpClientOnlyError } from '../../domain/errors/wallet.errors';
import { topUpSchema } from '../dto/wallet.dto';
import { TopUpWalletUseCase } from './top-up-wallet.use-case';

describe('TopUpWalletUseCase', () => {
  const setup = () => {
    const kit = createBookingsTestKit();
    const unitOfWork = new FakeUnitOfWork<WalletTransactionScope>((undo) => ({
      wallet: kit.wallet.withUndo(undo),
    }));
    return { ...kit, useCase: new TopUpWalletUseCase(unitOfWork) };
  };

  it('o cliente carrega saldo: devolve o novo saldo e regista TOP_UP no ledger', async () => {
    const { useCase, client, wallet } = setup();

    await useCase.execute(client, { amount: '1500.50' });
    const result = await useCase.execute(client, { amount: '0.50' });

    expect(result).toEqual({ balance: '1501.00' });
    expect(wallet.entriesOf(client.id)).toEqual([
      expect.objectContaining({
        type: 'TOP_UP',
        amount: '1500.50',
        balanceAfter: '1500.50',
        bookingId: null,
      }),
      expect.objectContaining({ amount: '0.50', balanceAfter: '1501.00' }),
    ]);
  });

  it('um prestador não carrega saldo (403)', async () => {
    const { useCase, provider, wallet } = setup();

    await expect(
      useCase.execute(provider, { amount: '100.00' }),
    ).rejects.toBeInstanceOf(TopUpClientOnlyError);
    expect(wallet.balanceOf(provider.id)).toBe('0.00');
  });
});

describe('topUpSchema', () => {
  it.each([
    ['1000000', '1000000.00'],
    ['0.01', '0.01'],
    [' 250.5 ', '250.50'],
  ])('aceita "%s" → "%s"', (amount, expected) => {
    expect(topUpSchema.parse({ amount })).toEqual({ amount: expected });
  });

  it.each([
    ['zero', '0'],
    ['zero com casas', '0.00'],
    ['acima do máximo', '1000000.01'],
    ['negativo', '-10'],
    ['3 casas decimais', '10.001'],
    ['texto', 'mil'],
    ['número JSON', 100],
    ['em falta', undefined],
  ])('rejeita %s', (_label, amount) => {
    expect(topUpSchema.safeParse({ amount }).success).toBe(false);
  });

  it('descarta campos desconhecidos (ex.: userId)', () => {
    expect(
      topUpSchema.parse({ amount: '10', userId: 'outro', balance: '9e9' }),
    ).toEqual({ amount: '10.00' });
  });
});

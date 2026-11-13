import { Money } from '@common/domain/money';
import { ConflictException } from '@common/exceptions';
import { InMemoryWalletRepository } from '@test/fakes/in-memory-wallet.repository';
import { WalletTransactionType } from '../entities/wallet-transaction.entity';
import { applyMovementsInLockOrder } from './apply-movements';

describe('applyMovementsInLockOrder', () => {
  const low = '00000000-0000-4000-8000-000000000001';
  const high = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

  it('aplica sempre por ordem crescente de userId (evita deadlocks)', async () => {
    const wallet = new InMemoryWalletRepository();
    wallet.setBalance(low, '100.00');
    wallet.setBalance(high, '100.00');
    const order: string[] = [];
    const spy = jest
      .spyOn(wallet, 'applyMovement')
      .mockImplementation((movement) => {
        order.push(movement.userId);
        return InMemoryWalletRepository.prototype.applyMovement.call(
          wallet,
          movement,
        );
      });

    await applyMovementsInLockOrder(wallet, [
      {
        userId: high,
        type: WalletTransactionType.BOOKING_DEBIT,
        amount: Money.parse('10').negated(),
        bookingId: 'b1',
      },
      {
        userId: low,
        type: WalletTransactionType.BOOKING_CREDIT,
        amount: Money.parse('10'),
        bookingId: 'b1',
      },
    ]);

    expect(order).toEqual([low, high]);
    spy.mockRestore();
  });

  it('débito recusado → lança o erro do movimento', async () => {
    const wallet = new InMemoryWalletRepository();
    wallet.setBalance(low, '5.00');

    await expect(
      applyMovementsInLockOrder(wallet, [
        {
          userId: low,
          type: WalletTransactionType.BOOKING_DEBIT,
          amount: Money.parse('5.01').negated(),
          bookingId: 'b1',
          onRejected: () => new ConflictException('sem saldo', 'NO_FUNDS'),
        },
      ]),
    ).rejects.toMatchObject({ code: 'NO_FUNDS' });
    expect(wallet.balanceOf(low)).toBe('5.00');
  });

  it('crédito numa conta inexistente → erro interno (invariante violada)', async () => {
    const wallet = new InMemoryWalletRepository();

    await expect(
      applyMovementsInLockOrder(wallet, [
        {
          userId: low,
          type: WalletTransactionType.TOP_UP,
          amount: Money.parse('5'),
        },
      ]),
    ).rejects.toMatchObject({ status: 500 });
  });
});

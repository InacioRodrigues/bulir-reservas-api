import { randomUUID } from 'node:crypto';
import { Money } from '@common/domain/money';
import { Actor } from '@common/types/actor';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { BookingTransactionScope } from '@modules/bookings/domain/ports/booking-unit-of-work';
import { CreateBookingUseCase } from '@modules/bookings/application/use-cases/create-booking.use-case';
import { CancelBookingUseCase } from '@modules/bookings/application/use-cases/cancel-booking.use-case';
import { WalletTransactionType } from '@modules/wallet/domain/entities/wallet-transaction.entity';
import { createServicesTestKit } from './services-test-kit';
import { FakeUnitOfWork } from './fake-unit-of-work';
import { InMemoryWalletRepository } from './in-memory-wallet.repository';
import { InMemoryBookingRepository } from './in-memory-booking.repository';

/**
 * Serviços, carteira e reservas em memória, ligados por uma unidade de
 * trabalho com rollback — os use cases reais correm sem BD.
 */
export function createBookingsTestKit() {
  const servicesKit = createServicesTestKit();
  const wallet = new InMemoryWalletRepository();
  const bookings = new InMemoryBookingRepository();
  const unitOfWork = new FakeUnitOfWork<BookingTransactionScope>((undo) => ({
    bookings: bookings.withUndo(undo),
    wallet: wallet.withUndo(undo),
  }));

  const { provider, otherProvider, client } = servicesKit;
  const otherClient: Actor = { id: randomUUID(), role: UserRole.CLIENT };

  const names: Array<[Actor, string]> = [
    [client, 'Ana Paula Domingos'],
    [otherClient, 'Bruno Miguel Cassoma'],
    [provider, 'Carla Sofia Neto'],
    [otherProvider, 'Daniel Tomás Lopes'],
  ];
  for (const [actor, name] of names) {
    wallet.openAccount(actor.id);
    bookings.store.userNames.set(actor.id, name);
  }

  /** Carrega saldo pelo ledger (mantém SUM(ledger) = saldo). */
  const fund = async (actor: Actor, amount: string) => {
    await wallet.applyMovement({
      userId: actor.id,
      type: WalletTransactionType.TOP_UP,
      amount: Money.parse(amount),
    });
  };

  const createBooking = new CreateBookingUseCase(
    servicesKit.services,
    unitOfWork,
  );
  const cancelBooking = new CancelBookingUseCase(bookings, unitOfWork);

  /** Para cada utilizador: saldo atual = soma do seu ledger? */
  const expectLedgerMatchesBalances = () => {
    for (const [actor] of names) {
      expect(wallet.ledgerSumOf(actor.id)).toBe(wallet.balanceOf(actor.id));
    }
  };

  return {
    ...servicesKit,
    otherClient,
    wallet,
    bookings,
    unitOfWork,
    fund,
    createBooking,
    cancelBooking,
    expectLedgerMatchesBalances,
  };
}

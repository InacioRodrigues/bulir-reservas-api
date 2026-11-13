import { Inject, Injectable } from '@nestjs/common';
import { Money } from '@common/domain/money';
import { Actor } from '@common/types/actor';
import { WalletTransactionType } from '@modules/wallet/domain/entities/wallet-transaction.entity';
import { applyMovementsInLockOrder } from '@modules/wallet/domain/services/apply-movements';
import { Booking } from '../../domain/entities/booking.entity';
import {
  BookingAlreadyCancelledError,
  BookingNotFoundError,
  ProviderInsufficientBalanceError,
} from '../../domain/errors/booking.errors';
import { BookingPolicy } from '../../domain/policies/booking-policy';
import {
  BOOKING_REPOSITORY,
  IBookingRepository,
} from '../../domain/repositories/booking.repository.interface';
import {
  BOOKING_UNIT_OF_WORK,
  IBookingUnitOfWork,
} from '../../domain/ports/booking-unit-of-work';

/**
 * Cancelamento pelo cliente da reserva ou pelo prestador do serviço, com
 * reembolso integral do preço pago (o snapshot, não o preço atual).
 *
 * Numa única transação:
 *  1. `UPDATE bookings ... WHERE status = 'CONFIRMED'` — só um pedido vence;
 *     os outros recebem `409 BOOKING_ALREADY_CANCELLED`;
 *  2. debita o prestador só se tiver saldo (senão `409 PROVIDER_INSUFFICIENT_BALANCE`
 *     e a reserva volta a CONFIRMED pelo rollback);
 *  3. credita o cliente;
 *  4. regista REFUND_DEBIT / REFUND_CREDIT no ledger (o `UNIQUE (booking_id, type)`
 *     torna impossível um segundo reembolso da mesma reserva).
 */
@Injectable()
export class CancelBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingsReader: IBookingRepository,
    @Inject(BOOKING_UNIT_OF_WORK)
    private readonly unitOfWork: IBookingUnitOfWork,
  ) {}

  async execute(actor: Actor, bookingId: string): Promise<Booking> {
    // Ordem: existe (404) → participa (403) → estado (409).
    const booking = await this.bookingsReader.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError();
    }
    BookingPolicy.assertIsParticipant(actor, booking);
    // Resposta rápida sem abrir transação; a garantia real é o UPDATE condicional.
    if (booking.isCancelled()) {
      throw new BookingAlreadyCancelledError();
    }

    const price = Money.parse(booking.price);

    return this.unitOfWork.run(async ({ bookings, wallet }) => {
      const cancelled = await bookings.cancelIfConfirmed(booking.id, actor.id);
      if (!cancelled) {
        throw new BookingAlreadyCancelledError();
      }

      await applyMovementsInLockOrder(wallet, [
        {
          userId: booking.providerId,
          type: WalletTransactionType.REFUND_DEBIT,
          amount: price.negated(),
          bookingId: booking.id,
          onRejected: () => new ProviderInsufficientBalanceError(),
        },
        {
          userId: booking.clientId,
          type: WalletTransactionType.REFUND_CREDIT,
          amount: price,
          bookingId: booking.id,
        },
      ]);

      return cancelled;
    });
  }
}

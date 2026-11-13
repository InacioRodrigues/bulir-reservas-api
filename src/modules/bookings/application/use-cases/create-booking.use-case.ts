import { Inject, Injectable } from '@nestjs/common';
import { Money } from '@common/domain/money';
import { Actor } from '@common/types/actor';
import {
  IServiceRepository,
  SERVICE_REPOSITORY,
} from '@modules/services/domain/repositories/service.repository.interface';
import { ServiceNotFoundError } from '@modules/services/domain/errors/service.errors';
import { WalletTransactionType } from '@modules/wallet/domain/entities/wallet-transaction.entity';
import { InsufficientBalanceError } from '@modules/wallet/domain/errors/wallet.errors';
import { applyMovementsInLockOrder } from '@modules/wallet/domain/services/apply-movements';
import { Booking } from '../../domain/entities/booking.entity';
import { BookingPolicy } from '../../domain/policies/booking-policy';
import {
  BOOKING_UNIT_OF_WORK,
  IBookingUnitOfWork,
} from '../../domain/ports/booking-unit-of-work';
import { CreateBookingDto } from '../dto/booking.dto';

/**
 * Um cliente reserva um serviço e paga-o com o saldo da carteira.
 *
 * Numa única transação (tudo ou nada):
 *  1. cria a reserva com o snapshot do serviço (nome, preço, prestador);
 *  2. debita o cliente **só se tiver saldo** (`UPDATE ... WHERE balance >= preço`);
 *  3. credita o prestador;
 *  4. regista os dois movimentos no ledger (BOOKING_DEBIT / BOOKING_CREDIT).
 * Se o débito for recusado, lança `409 INSUFFICIENT_BALANCE` e o rollback
 * desfaz o passo 1 — não fica reserva sem pagamento nem pagamento sem reserva.
 */
@Injectable()
export class CreateBookingUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly services: IServiceRepository,
    @Inject(BOOKING_UNIT_OF_WORK)
    private readonly unitOfWork: IBookingUnitOfWork,
  ) {}

  async execute(actor: Actor, dto: CreateBookingDto): Promise<Booking> {
    BookingPolicy.assertCanBook(actor);

    // Eliminado (soft delete) = inexistente: 404.
    const service = await this.services.findActiveById(dto.serviceId);
    if (!service) {
      throw new ServiceNotFoundError();
    }
    BookingPolicy.assertCanBook(actor, service);

    const booking = Booking.create({ clientId: actor.id, service });
    const price = Money.parse(booking.price);

    return this.unitOfWork.run(async ({ bookings, wallet }) => {
      // A reserva é inserida primeiro porque os movimentos do ledger têm uma
      // FK para ela; se o débito falhar, o rollback remove-a.
      const saved = await bookings.create(booking);

      await applyMovementsInLockOrder(wallet, [
        {
          userId: saved.clientId,
          type: WalletTransactionType.BOOKING_DEBIT,
          amount: price.negated(),
          bookingId: saved.id,
          onRejected: () => new InsufficientBalanceError(),
        },
        {
          userId: saved.providerId,
          type: WalletTransactionType.BOOKING_CREDIT,
          amount: price,
          bookingId: saved.id,
        },
      ]);

      return saved;
    });
  }
}

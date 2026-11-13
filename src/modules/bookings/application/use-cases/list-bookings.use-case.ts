import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@common/pagination/pagination';
import { Actor } from '@common/types/actor';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { Booking } from '../../domain/entities/booking.entity';
import {
  BOOKING_REPOSITORY,
  IBookingRepository,
} from '../../domain/repositories/booking.repository.interface';
import { ListBookingsQueryDto } from '../dto/booking.dto';

/**
 * Histórico de reservas do utilizador autenticado: as que fez (cliente) ou as
 * dos seus serviços (prestador), incluindo canceladas e de serviços já
 * eliminados — o histórico nunca se perde.
 */
@Injectable()
export class ListBookingsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: IBookingRepository,
  ) {}

  execute(actor: Actor, query: ListBookingsQueryDto): Promise<Page<Booking>> {
    const participant =
      actor.role === UserRole.CLIENT
        ? { clientId: actor.id }
        : { providerId: actor.id };
    return this.bookings.search({ ...query, ...participant });
  }
}

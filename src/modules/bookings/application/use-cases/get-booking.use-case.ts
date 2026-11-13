import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '@common/types/actor';
import { Booking } from '../../domain/entities/booking.entity';
import { BookingNotFoundError } from '../../domain/errors/booking.errors';
import { BookingPolicy } from '../../domain/policies/booking-policy';
import {
  BOOKING_REPOSITORY,
  IBookingRepository,
} from '../../domain/repositories/booking.repository.interface';

/** Detalhe de uma reserva: só o cliente e o prestador a podem ver. */
@Injectable()
export class GetBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: IBookingRepository,
  ) {}

  async execute(actor: Actor, bookingId: string): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError();
    }
    BookingPolicy.assertIsParticipant(actor, booking);
    return booking;
  }
}

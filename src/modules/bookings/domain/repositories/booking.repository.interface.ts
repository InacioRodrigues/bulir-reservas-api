import { Booking } from '../entities/booking.entity';

export interface IBookingRepository {
  /** Insere a reserva e devolve-a com `id`, datas e nomes de cliente/prestador. */
  create(booking: Booking): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  /**
   * Cancela **só se ainda estiver confirmada**, numa instrução condicional:
   * `UPDATE bookings SET status = 'CANCELLED', ... WHERE id = ? AND status = 'CONFIRMED'`.
   * Entre dois cancelamentos simultâneos só um altera a linha.
   *
   * @returns a reserva cancelada, ou `null` se já não estava confirmada.
   */
  cancelIfConfirmed(id: string, cancelledById: string): Promise<Booking | null>;
}

export const BOOKING_REPOSITORY = Symbol('IBookingRepository');

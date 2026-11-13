import { Page, PaginationQuery } from '@common/pagination/pagination';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../entities/booking-status';

/**
 * Histórico de um participante: exatamente um de `clientId`/`providerId`
 * (um utilizador é cliente ou prestador, nunca ambos), para a consulta usar
 * o índice `(client_id, created_at DESC)` ou `(provider_id, created_at DESC)`.
 */
export type BookingSearchCriteria = PaginationQuery & {
  status?: BookingStatus;
} & ({ clientId: string } | { providerId: string });

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
  /** Reservas do participante, mais recentes primeiro. */
  search(criteria: BookingSearchCriteria): Promise<Page<Booking>>;
}

export const BOOKING_REPOSITORY = Symbol('IBookingRepository');

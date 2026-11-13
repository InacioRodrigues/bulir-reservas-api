import { UserRole } from '@modules/users/domain/entities/user-role';
import { Booking } from '../../domain/entities/booking.entity';
import { BookingStatus } from '../../domain/entities/booking-status';

/** Forma pública da reserva (ver `Booking` em CONTRATO-API.md). */
export interface BookingResponse {
  id: string;
  status: BookingStatus;
  price: string;
  service: { id: string; name: string };
  client: { id: string; fullName: string };
  provider: { id: string; fullName: string };
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: UserRole | null;
}

export class BookingPresenter {
  static toResponse(booking: Booking): BookingResponse {
    return {
      id: booking.id,
      status: booking.status,
      price: booking.price,
      service: { id: booking.serviceId, name: booking.serviceName },
      client: { id: booking.clientId, fullName: booking.clientName ?? '' },
      provider: {
        id: booking.providerId,
        fullName: booking.providerName ?? '',
      },
      createdAt: booking.createdAt.toISOString(),
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      cancelledBy: booking.cancelledByRole(),
    };
  }
}

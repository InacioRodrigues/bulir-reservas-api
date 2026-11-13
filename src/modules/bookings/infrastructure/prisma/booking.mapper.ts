import { Prisma } from '@prisma/client';
import { Booking } from '../../domain/entities/booking.entity';

/**
 * Colunas lidas em todas as consultas. Os nomes do cliente e do prestador
 * são carregados em lote — o Prisma faz uma query `WHERE id IN (...)` por
 * relação para a página inteira, não uma por reserva (sem N+1): uma página
 * de 100 reservas custa 3 queries, tal como uma de 1. Só campos públicos:
 * nunca carregamos password hash, NIF ou saldo da outra parte.
 */
export const bookingSelect = {
  id: true,
  clientId: true,
  providerId: true,
  serviceId: true,
  serviceName: true,
  price: true,
  status: true,
  cancelledAt: true,
  cancelledById: true,
  createdAt: true,
  client: { select: { fullName: true } },
  provider: { select: { fullName: true } },
} satisfies Prisma.BookingSelect;

export type BookingRow = Prisma.BookingGetPayload<{
  select: typeof bookingSelect;
}>;

export class BookingMapper {
  static toDomain(raw: BookingRow): Booking {
    return new Booking({
      id: raw.id,
      clientId: raw.clientId,
      clientName: raw.client.fullName,
      providerId: raw.providerId,
      providerName: raw.provider.fullName,
      serviceId: raw.serviceId,
      serviceName: raw.serviceName,
      // Decimal → string com 2 casas, sem passar por `number`.
      price: raw.price.toFixed(2),
      status: raw.status,
      cancelledAt: raw.cancelledAt,
      cancelledById: raw.cancelledById,
      createdAt: raw.createdAt,
    });
  }

  static toCreateInput(domain: Booking): Prisma.BookingUncheckedCreateInput {
    return {
      clientId: domain.clientId,
      providerId: domain.providerId,
      serviceId: domain.serviceId,
      serviceName: domain.serviceName,
      price: domain.price,
    };
  }
}

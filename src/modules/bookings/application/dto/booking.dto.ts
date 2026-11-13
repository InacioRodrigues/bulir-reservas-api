import { z } from 'zod';
import { paginationQuerySchema } from '@common/pagination/pagination';
import { BOOKING_STATUSES } from '../../domain/entities/booking-status';

/**
 * Só o `serviceId`: cliente, prestador e preço nunca vêm do corpo — o cliente
 * é o utilizador autenticado e o resto é lido do serviço (campos extra, como
 * `price` ou `clientId`, são descartados pelo zod).
 */
export const createBookingSchema = z.object({
  serviceId: z.uuid({ error: 'serviceId deve ser um UUID válido' }),
});

export type CreateBookingDto = z.infer<typeof createBookingSchema>;

export const listBookingsQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(BOOKING_STATUSES, {
      error: `status deve ser um de: ${BOOKING_STATUSES.join(', ')}`,
    })
    .optional(),
});

export type ListBookingsQueryDto = z.infer<typeof listBookingsQuerySchema>;

import { z } from 'zod';

/**
 * Só o `serviceId`: cliente, prestador e preço nunca vêm do corpo — o cliente
 * é o utilizador autenticado e o resto é lido do serviço (campos extra, como
 * `price` ou `clientId`, são descartados pelo zod).
 */
export const createBookingSchema = z.object({
  serviceId: z.uuid({ error: 'serviceId deve ser um UUID válido' }),
});

export type CreateBookingDto = z.infer<typeof createBookingSchema>;

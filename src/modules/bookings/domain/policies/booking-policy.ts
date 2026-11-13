import { Actor } from '@common/types/actor';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { Service } from '@modules/services/domain/entities/service.entity';
import { Booking } from '../entities/booking.entity';
import {
  CannotBookOwnServiceError,
  ClientOnlyBookingError,
  NotBookingParticipantError,
} from '../errors/booking.errors';

/**
 * Permissões sobre reservas, sem depender do HTTP. O `@Roles('CLIENT')` do
 * controller só trava cedo; a regra vive aqui e vale para qualquer chamador.
 */
export const BookingPolicy = {
  /** Só clientes reservam, e nunca um serviço que publicaram. */
  assertCanBook(actor: Actor, service?: Service): void {
    if (actor.role !== UserRole.CLIENT) {
      throw new ClientOnlyBookingError();
    }
    if (service?.isOwnedBy(actor.id)) {
      throw new CannotBookOwnServiceError();
    }
  },

  /** Consultar e cancelar: só o cliente da reserva ou o prestador do serviço. */
  assertIsParticipant(actor: Actor, booking: Booking): void {
    if (!booking.isParticipant(actor.id)) {
      throw new NotBookingParticipantError();
    }
  },
};

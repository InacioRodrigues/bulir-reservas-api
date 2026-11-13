import { Actor } from '@common/types/actor';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { Service } from '../entities/service.entity';
import {
  NotServiceOwnerError,
  ProviderOnlyError,
} from '../errors/service.errors';

/**
 * Regras de permissão sobre serviços, num só sítio e sem depender do HTTP.
 *
 * O `@Roles('PROVIDER')` no controller é a primeira barreira (rejeita cedo,
 * sem ir à BD); estas verificações são a regra de negócio em si e valem para
 * qualquer chamador do use case.
 */
export const ServicePolicy = {
  /** Só prestadores criam, editam, eliminam ou listam "os seus" serviços. */
  assertIsProvider(actor: Actor): void {
    if (actor.role !== UserRole.PROVIDER) {
      throw new ProviderOnlyError();
    }
  },

  /** Só o prestador que publicou o serviço o pode alterar ou eliminar. */
  assertIsOwner(actor: Actor, service: Service): void {
    if (!service.isOwnedBy(actor.id)) {
      throw new NotServiceOwnerError();
    }
  },
};

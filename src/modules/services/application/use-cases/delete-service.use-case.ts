import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '@common/types/actor';
import { ServiceNotFoundError } from '../../domain/errors/service.errors';
import { ServicePolicy } from '../../domain/policies/service-policy';
import {
  IServiceRepository,
  SERVICE_REPOSITORY,
} from '../../domain/repositories/service.repository.interface';

/**
 * Eliminação pelo dono, em soft delete: o serviço sai do catálogo e deixa de
 * poder ser reservado, mas a linha fica na BD para que as reservas antigas
 * (FK `ON DELETE RESTRICT`) e o histórico se mantenham intactos.
 */
@Injectable()
export class DeleteServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly services: IServiceRepository,
  ) {}

  async execute(actor: Actor, serviceId: string): Promise<void> {
    ServicePolicy.assertIsProvider(actor);

    const service = await this.services.findActiveById(serviceId);
    if (!service) {
      throw new ServiceNotFoundError();
    }
    ServicePolicy.assertIsOwner(actor, service);

    // `false` = outro pedido eliminou-o primeiro (o UPDATE é condicional).
    const deleted = await this.services.softDelete(service.id);
    if (!deleted) {
      throw new ServiceNotFoundError();
    }
  }
}

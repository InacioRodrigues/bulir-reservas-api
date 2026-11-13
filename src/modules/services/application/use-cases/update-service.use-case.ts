import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '@common/types/actor';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError } from '../../domain/errors/service.errors';
import { ServicePolicy } from '../../domain/policies/service-policy';
import {
  IServiceRepository,
  SERVICE_REPOSITORY,
} from '../../domain/repositories/service.repository.interface';
import { UpdateServiceDto } from '../dto/service.dto';

/**
 * Alteração parcial de um serviço pelo seu dono.
 *
 * Ordem das verificações: papel → existe (404) → é dono (403). As reservas já
 * feitas não mudam: guardam o nome e o preço do momento da reserva.
 */
@Injectable()
export class UpdateServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly services: IServiceRepository,
  ) {}

  async execute(
    actor: Actor,
    serviceId: string,
    changes: UpdateServiceDto,
  ): Promise<Service> {
    ServicePolicy.assertIsProvider(actor);

    const service = await this.services.findActiveById(serviceId);
    if (!service) {
      throw new ServiceNotFoundError();
    }
    ServicePolicy.assertIsOwner(actor, service);

    service.update(changes);

    // `null` = eliminado entre a leitura e a escrita (pedido concorrente).
    const saved = await this.services.update(service);
    if (!saved) {
      throw new ServiceNotFoundError();
    }
    return saved;
  }
}

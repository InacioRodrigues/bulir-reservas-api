import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '@common/types/actor';
import { Service } from '../../domain/entities/service.entity';
import { ServicePolicy } from '../../domain/policies/service-policy';
import {
  IServiceRepository,
  SERVICE_REPOSITORY,
} from '../../domain/repositories/service.repository.interface';
import { CreateServiceDto } from '../dto/service.dto';

/** Um prestador publica um serviço; fica associado a quem o criou. */
@Injectable()
export class CreateServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly services: IServiceRepository,
  ) {}

  async execute(actor: Actor, dto: CreateServiceDto): Promise<Service> {
    ServicePolicy.assertIsProvider(actor);

    const service = Service.create({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      providerId: actor.id,
    });

    return this.services.create(service);
  }
}

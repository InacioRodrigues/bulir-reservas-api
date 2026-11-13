import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '@common/types/actor';
import { Page } from '@common/pagination/pagination';
import { Service } from '../../domain/entities/service.entity';
import { ServicePolicy } from '../../domain/policies/service-policy';
import {
  IServiceRepository,
  SERVICE_REPOSITORY,
} from '../../domain/repositories/service.repository.interface';
import { MyServicesQueryDto } from '../dto/service.dto';

/** "Os meus serviços": os serviços ativos do prestador autenticado. */
@Injectable()
export class ListProviderServicesUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly services: IServiceRepository,
  ) {}

  async execute(
    actor: Actor,
    query: MyServicesQueryDto,
  ): Promise<Page<Service>> {
    ServicePolicy.assertIsProvider(actor);

    return await this.services.search({
      ...query,
      sort: 'newest',
      providerId: actor.id,
    });
  }
}

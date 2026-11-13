import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@common/pagination/pagination';
import { Service } from '../../domain/entities/service.entity';
import {
  IServiceRepository,
  SERVICE_REPOSITORY,
} from '../../domain/repositories/service.repository.interface';
import { ListServicesQueryDto } from '../dto/service.dto';

/** Catálogo: serviços ativos de todos os prestadores, com pesquisa e filtros. */
@Injectable()
export class ListServicesUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly services: IServiceRepository,
  ) {}

  execute(query: ListServicesQueryDto): Promise<Page<Service>> {
    return this.services.search(query);
  }
}

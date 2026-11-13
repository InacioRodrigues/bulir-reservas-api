import { Inject, Injectable } from '@nestjs/common';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError } from '../../domain/errors/service.errors';
import {
  IServiceRepository,
  SERVICE_REPOSITORY,
} from '../../domain/repositories/service.repository.interface';

/** Detalhe de um serviço ativo. Eliminado = inexistente (404). */
@Injectable()
export class GetServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly services: IServiceRepository,
  ) {}

  async execute(id: string): Promise<Service> {
    const service = await this.services.findActiveById(id);
    if (!service) {
      throw new ServiceNotFoundError();
    }
    return service;
  }
}

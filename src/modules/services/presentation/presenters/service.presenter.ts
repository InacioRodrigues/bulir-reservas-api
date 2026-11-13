import { Service } from '../../domain/entities/service.entity';

/** Forma pública do serviço (ver `Service` em CONTRATO-API.md). */
export interface ServiceResponse {
  id: string;
  name: string;
  description: string;
  price: string;
  provider: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export class ServicePresenter {
  static toResponse(service: Service): ServiceResponse {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      provider: {
        id: service.providerId,
        fullName: service.providerName ?? '',
      },
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
    };
  }
}

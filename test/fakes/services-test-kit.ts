import { randomUUID } from 'node:crypto';
import { Actor } from '@common/types/actor';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { CreateServiceUseCase } from '@modules/services/application/use-cases/create-service.use-case';
import { CreateServiceDto } from '@modules/services/application/dto/service.dto';
import { InMemoryServiceRepository } from './in-memory-service.repository';

/** Repositório em memória + atores prontos para os testes de serviços. */
export function createServicesTestKit() {
  const services = new InMemoryServiceRepository();
  const createService = new CreateServiceUseCase(services);

  const provider: Actor = { id: randomUUID(), role: UserRole.PROVIDER };
  const otherProvider: Actor = { id: randomUUID(), role: UserRole.PROVIDER };
  const client: Actor = { id: randomUUID(), role: UserRole.CLIENT };
  services.providerNames.set(provider.id, 'Carla Sofia Neto');
  services.providerNames.set(otherProvider.id, 'Daniel Tomás Lopes');

  const seedService = (
    owner: Actor = provider,
    overrides: Partial<CreateServiceDto> = {},
  ) =>
    createService.execute(owner, {
      name: 'Limpeza doméstica',
      description: 'Limpeza completa de apartamento T2',
      price: '5000.00',
      ...overrides,
    });

  return {
    services,
    createService,
    provider,
    otherProvider,
    client,
    seedService,
  };
}

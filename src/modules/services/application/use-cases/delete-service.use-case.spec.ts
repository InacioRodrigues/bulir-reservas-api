import { randomUUID } from 'node:crypto';
import { createServicesTestKit } from '@test/fakes/services-test-kit';
import {
  NotServiceOwnerError,
  ProviderOnlyError,
  ServiceNotFoundError,
} from '../../domain/errors/service.errors';
import { DeleteServiceUseCase } from './delete-service.use-case';
import { GetServiceUseCase } from './get-service.use-case';

describe('DeleteServiceUseCase', () => {
  const setup = () => {
    const kit = createServicesTestKit();
    return {
      ...kit,
      useCase: new DeleteServiceUseCase(kit.services),
      getService: new GetServiceUseCase(kit.services),
    };
  };

  it('o dono elimina (soft delete): sai do catálogo mas o registo mantém-se', async () => {
    const { useCase, getService, provider, seedService, services } = setup();
    const service = await seedService();

    await useCase.execute(provider, service.id);

    // O registo continua a existir (as reservas antigas apontam para ele)…
    expect(services.items).toHaveLength(1);
    expect(services.items[0].deletedAt).toBeInstanceOf(Date);
    // …mas deixou de ser visível.
    await expect(getService.execute(service.id)).rejects.toBeInstanceOf(
      ServiceNotFoundError,
    );
    const page = await services.search({
      page: 1,
      perPage: 20,
      sort: 'newest',
    });
    expect(page.total).toBe(0);
  });

  it('outro prestador não pode eliminar (403) e o serviço continua ativo', async () => {
    const { useCase, otherProvider, seedService, services } = setup();
    const service = await seedService();

    await expect(
      useCase.execute(otherProvider, service.id),
    ).rejects.toBeInstanceOf(NotServiceOwnerError);
    expect(services.items[0].isDeleted()).toBe(false);
  });

  it('um cliente não pode eliminar (403)', async () => {
    const { useCase, client, seedService } = setup();
    const service = await seedService();

    await expect(useCase.execute(client, service.id)).rejects.toBeInstanceOf(
      ProviderOnlyError,
    );
  });

  it('eliminar duas vezes → 404 na segunda', async () => {
    const { useCase, provider, seedService } = setup();
    const service = await seedService();

    await useCase.execute(provider, service.id);

    await expect(useCase.execute(provider, service.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('dois pedidos simultâneos: só um elimina, o outro recebe 404', async () => {
    const { useCase, provider, seedService } = setup();
    const service = await seedService();

    const results = await Promise.allSettled([
      useCase.execute(provider, service.id),
      useCase.execute(provider, service.id),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ServiceNotFoundError);
  });

  it('serviço inexistente → 404', async () => {
    const { useCase, provider } = setup();

    await expect(
      useCase.execute(provider, randomUUID()),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });
});

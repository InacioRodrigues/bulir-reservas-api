import { randomUUID } from 'node:crypto';
import { createServicesTestKit } from '@test/fakes/services-test-kit';
import {
  NotServiceOwnerError,
  ProviderOnlyError,
  ServiceNotFoundError,
} from '../../domain/errors/service.errors';
import { UpdateServiceUseCase } from './update-service.use-case';

describe('UpdateServiceUseCase', () => {
  const setup = () => {
    const kit = createServicesTestKit();
    return { ...kit, useCase: new UpdateServiceUseCase(kit.services) };
  };

  it('o dono altera apenas os campos enviados', async () => {
    const { useCase, provider, seedService, services } = setup();
    const service = await seedService();

    const updated = await useCase.execute(provider, service.id, {
      price: '6000',
    });

    expect(updated.price).toBe('6000.00');
    expect(updated.name).toBe(service.name);
    expect(updated.description).toBe(service.description);
    expect(services.items[0].price).toBe('6000.00');
  });

  it('outro prestador não pode alterar (403 FORBIDDEN) e nada muda', async () => {
    const { useCase, otherProvider, seedService, services } = setup();
    const service = await seedService();

    const promise = useCase.execute(otherProvider, service.id, {
      name: 'Serviço roubado',
    });

    await expect(promise).rejects.toBeInstanceOf(NotServiceOwnerError);
    await expect(promise).rejects.toMatchObject({ status: 403 });
    expect(services.items[0].name).toBe('Limpeza doméstica');
  });

  it('um cliente não pode alterar (403)', async () => {
    const { useCase, client, seedService } = setup();
    const service = await seedService();

    await expect(
      useCase.execute(client, service.id, { name: 'Outro nome' }),
    ).rejects.toBeInstanceOf(ProviderOnlyError);
  });

  it('serviço inexistente → 404 NOT_FOUND', async () => {
    const { useCase, provider } = setup();

    await expect(
      useCase.execute(provider, randomUUID(), { name: 'Outro nome' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('serviço eliminado → 404 (mesmo para o dono)', async () => {
    const { useCase, provider, seedService, services } = setup();
    const service = await seedService();
    await services.softDelete(service.id);

    await expect(
      useCase.execute(provider, service.id, { name: 'Outro nome' }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  it('eliminado entre a leitura e a escrita (corrida) → 404', async () => {
    const { useCase, provider, seedService, services } = setup();
    const service = await seedService();
    jest.spyOn(services, 'update').mockResolvedValueOnce(null);

    await expect(
      useCase.execute(provider, service.id, { name: 'Outro nome' }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  it('rejeita preço inválido na alteração (400)', async () => {
    const { useCase, provider, seedService, services } = setup();
    const service = await seedService();

    await expect(
      useCase.execute(provider, service.id, { price: '0.00' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(services.items[0].price).toBe('5000.00');
  });
});

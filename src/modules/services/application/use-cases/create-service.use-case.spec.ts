import { ValidationException } from '@common/exceptions';
import { createServicesTestKit } from '@test/fakes/services-test-kit';
import { ProviderOnlyError } from '../../domain/errors/service.errors';

describe('CreateServiceUseCase', () => {
  const dto = {
    name: 'Canalização',
    description: 'Reparação de fugas e torneiras',
    price: '7500.00',
  };

  it('um prestador cria um serviço associado a si próprio', async () => {
    const { createService, provider, services } = createServicesTestKit();

    const service = await createService.execute(provider, dto);

    expect(service.id).toBeTruthy();
    expect(service.providerId).toBe(provider.id);
    expect(service.providerName).toBe('Carla Sofia Neto');
    expect(service.price).toBe('7500.00');
    expect(services.items).toHaveLength(1);
  });

  it('um cliente não pode criar serviços (403 FORBIDDEN)', async () => {
    const { createService, client, services } = createServicesTestKit();

    const promise = createService.execute(client, dto);

    await expect(promise).rejects.toBeInstanceOf(ProviderOnlyError);
    await expect(promise).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(services.items).toHaveLength(0);
  });

  it('normaliza o preço para 2 casas e apara os textos', async () => {
    const { createService, provider } = createServicesTestKit();

    const service = await createService.execute(provider, {
      name: '  Canalização  ',
      description: '  Reparação de fugas e torneiras ',
      price: '7500.5',
    });

    expect(service.price).toBe('7500.50');
    expect(service.name).toBe('Canalização');
    expect(service.description).toBe('Reparação de fugas e torneiras');
  });

  it.each(['0', '0.00', '-10.00', '1.999', 'abc', '10000000.01'])(
    'rejeita o preço inválido "%s" (400 VALIDATION_ERROR), mesmo sem passar pelo DTO',
    async (price) => {
      const { createService, provider, services } = createServicesTestKit();

      const promise = createService.execute(provider, { ...dto, price });

      await expect(promise).rejects.toBeInstanceOf(ValidationException);
      await expect(promise).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        errors: [expect.objectContaining({ field: 'price' })],
      });
      expect(services.items).toHaveLength(0);
    },
  );

  it('aceita o preço máximo (10 000 000.00) e o mínimo (0.01)', async () => {
    const { createService, provider } = createServicesTestKit();

    await expect(
      createService.execute(provider, { ...dto, price: '10000000.00' }),
    ).resolves.toMatchObject({ price: '10000000.00' });
    await expect(
      createService.execute(provider, { ...dto, price: '0.01' }),
    ).resolves.toMatchObject({ price: '0.01' });
  });

  it('rejeita nome demasiado curto mesmo sem passar pelo DTO', async () => {
    const { createService, provider } = createServicesTestKit();

    await expect(
      createService.execute(provider, { ...dto, name: '  ab  ' }),
    ).rejects.toMatchObject({ errors: [{ field: 'name' }] });
  });
});

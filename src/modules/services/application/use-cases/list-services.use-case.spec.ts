import { createServicesTestKit } from '@test/fakes/services-test-kit';
import { ProviderOnlyError } from '../../domain/errors/service.errors';
import { ListServicesUseCase } from './list-services.use-case';
import { ListProviderServicesUseCase } from './list-provider-services.use-case';
import { GetServiceUseCase } from './get-service.use-case';

describe('Listagem de serviços', () => {
  const setup = async () => {
    const kit = createServicesTestKit();
    const { provider, otherProvider, seedService } = kit;
    const limpeza = await seedService(provider, {
      name: 'Limpeza doméstica',
      price: '5000.00',
    });
    const jardim = await seedService(provider, {
      name: 'Jardinagem',
      description: 'Corte de relva e LIMPEZA de canteiros',
      price: '7500.00',
    });
    const eletricidade = await seedService(otherProvider, {
      name: 'Eletricidade',
      description: 'Instalação de tomadas e quadros elétricos',
      price: '12000.00',
    });
    return {
      ...kit,
      limpeza,
      jardim,
      eletricidade,
      list: new ListServicesUseCase(kit.services),
      mine: new ListProviderServicesUseCase(kit.services),
      get: new GetServiceUseCase(kit.services),
    };
  };
  const base = { page: 1, perPage: 20, sort: 'newest' as const };

  it('lista todos os serviços ativos, mais recentes primeiro', async () => {
    const { list, eletricidade, jardim, limpeza } = await setup();

    const page = await list.execute(base);

    expect(page.items.map((s) => s.id)).toEqual([
      eletricidade.id,
      jardim.id,
      limpeza.id,
    ]);
    expect(page.total).toBe(3);
  });

  it('não lista serviços eliminados', async () => {
    const { list, services, jardim } = await setup();
    await services.softDelete(jardim.id);

    const page = await list.execute(base);

    expect(page.items.map((s) => s.name)).not.toContain('Jardinagem');
    expect(page.total).toBe(2);
  });

  it('pesquisa no nome e na descrição sem distinguir maiúsculas', async () => {
    const { list } = await setup();

    const page = await list.execute({ ...base, search: 'limpeza' });

    expect(page.items.map((s) => s.name).sort()).toEqual([
      'Jardinagem',
      'Limpeza doméstica',
    ]);
  });

  it('filtra por intervalo de preço (limites inclusivos)', async () => {
    const { list } = await setup();

    const page = await list.execute({
      ...base,
      minPrice: '5000.00',
      maxPrice: '7500.00',
    });

    expect(page.items.map((s) => s.price).sort()).toEqual([
      '5000.00',
      '7500.00',
    ]);
  });

  it('ordena por preço (comparação decimal, não alfabética)', async () => {
    const { list } = await setup();

    const asc = await list.execute({ ...base, sort: 'price_asc' });
    const desc = await list.execute({ ...base, sort: 'price_desc' });

    // Alfabeticamente "12000.00" < "5000.00"; numericamente não.
    expect(asc.items.map((s) => s.price)).toEqual([
      '5000.00',
      '7500.00',
      '12000.00',
    ]);
    expect(desc.items.map((s) => s.price)).toEqual([
      '12000.00',
      '7500.00',
      '5000.00',
    ]);
  });

  it('pagina os resultados', async () => {
    const { list } = await setup();

    const page2 = await list.execute({ ...base, page: 2, perPage: 2 });

    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(3);
    expect(page2.page).toBe(2);
  });

  it('"os meus serviços" devolve só os do prestador autenticado', async () => {
    const { mine, provider, otherProvider } = await setup();

    const own = await mine.execute(provider, { page: 1, perPage: 20 });
    const other = await mine.execute(otherProvider, { page: 1, perPage: 20 });

    expect(own.items.every((s) => s.providerId === provider.id)).toBe(true);
    expect(own.total).toBe(2);
    expect(other.items.map((s) => s.name)).toEqual(['Eletricidade']);
  });

  it('"os meus serviços" é só para prestadores (403)', async () => {
    const { mine, client } = await setup();

    await expect(
      mine.execute(client, { page: 1, perPage: 20 }),
    ).rejects.toBeInstanceOf(ProviderOnlyError);
  });

  it('detalhe de um serviço ativo inclui o prestador', async () => {
    const { get, limpeza, provider } = await setup();

    const service = await get.execute(limpeza.id);

    expect(service.providerId).toBe(provider.id);
    expect(service.providerName).toBe('Carla Sofia Neto');
  });
});

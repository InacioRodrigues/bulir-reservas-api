import {
  createServiceSchema,
  listServicesQuerySchema,
  updateServiceSchema,
} from './service.dto';

const valid = {
  name: 'Limpeza doméstica',
  description: 'Limpeza completa de apartamento T2',
  price: '5000',
};

const fieldsOf = (result: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.'));

describe('createServiceSchema', () => {
  it('normaliza o preço e descarta campos desconhecidos (mass assignment)', () => {
    const parsed = createServiceSchema.parse({
      ...valid,
      providerId: 'outro-prestador',
      deletedAt: null,
    });

    expect(parsed).toEqual({ ...valid, price: '5000.00' });
    expect(parsed).not.toHaveProperty('providerId');
  });

  it('rejeita o preço enviado como número JSON', () => {
    const result = createServiceSchema.safeParse({ ...valid, price: 5000 });
    expect(fieldsOf(result)).toEqual(['price']);
  });

  it.each(['0', '0.00', '-1', '1.234', '1,50', '10000000.01', ''])(
    'rejeita o preço "%s"',
    (price) => {
      const result = createServiceSchema.safeParse({ ...valid, price });
      expect(fieldsOf(result)).toEqual(['price']);
    },
  );

  it('valida os limites de nome (3–100) e descrição (10–1000)', () => {
    const result = createServiceSchema.safeParse({
      name: 'ab',
      description: 'curta',
      price: '1',
    });
    expect(fieldsOf(result)).toEqual(['name', 'description']);
  });
});

describe('updateServiceSchema', () => {
  it('aceita alterações parciais', () => {
    expect(updateServiceSchema.parse({ price: '10.5' })).toEqual({
      price: '10.50',
    });
  });

  it('rejeita um corpo sem nenhum campo editável', () => {
    expect(updateServiceSchema.safeParse({}).success).toBe(false);
    expect(updateServiceSchema.safeParse({ providerId: 'x' }).success).toBe(
      false,
    );
  });
});

describe('listServicesQuerySchema', () => {
  it('aplica valores por omissão', () => {
    expect(listServicesQuerySchema.parse({})).toEqual({
      page: 1,
      perPage: 20,
      sort: 'newest',
    });
  });

  it('normaliza filtros e trata pesquisa vazia como ausente', () => {
    expect(
      listServicesQuerySchema.parse({
        search: '   ',
        minPrice: '1000',
        maxPrice: '5000.5',
        sort: 'price_asc',
      }),
    ).toEqual({
      page: 1,
      perPage: 20,
      search: undefined,
      minPrice: '1000.00',
      maxPrice: '5000.50',
      sort: 'price_asc',
    });
  });

  it('rejeita minPrice > maxPrice (comparação decimal)', () => {
    const result = listServicesQuerySchema.safeParse({
      minPrice: '9000',
      maxPrice: '10000',
    });
    expect(result.success).toBe(true);

    const invalid = listServicesQuerySchema.safeParse({
      minPrice: '10000',
      maxPrice: '9000',
    });
    expect(fieldsOf(invalid)).toEqual(['maxPrice']);
  });

  it('rejeita ordenação desconhecida e perPage acima de 100', () => {
    const result = listServicesQuerySchema.safeParse({
      sort: 'price; DROP TABLE services',
      perPage: '500',
    });
    expect(fieldsOf(result)?.sort()).toEqual(['perPage', 'sort']);
  });
});

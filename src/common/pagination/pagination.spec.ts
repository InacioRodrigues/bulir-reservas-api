import { pageOffset, paginationQuerySchema, toPageMeta } from './pagination';

describe('pagination', () => {
  it('aplica os valores por omissão (page=1, perPage=20)', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, perPage: 20 });
  });

  it('converte os valores da query string', () => {
    expect(paginationQuerySchema.parse({ page: '3', perPage: '50' })).toEqual({
      page: 3,
      perPage: 50,
    });
  });

  it.each([
    [{ perPage: '101' }],
    [{ perPage: '0' }],
    [{ page: '0' }],
    [{ page: '1.5' }],
    [{ page: 'abc' }],
  ])('rejeita %o', (query) => {
    expect(paginationQuerySchema.safeParse(query).success).toBe(false);
  });

  it('calcula offset e meta', () => {
    expect(pageOffset({ page: 3, perPage: 20 })).toBe(40);
    expect(toPageMeta({ items: [], total: 41, page: 1, perPage: 20 })).toEqual({
      page: 1,
      perPage: 20,
      total: 41,
      totalPages: 3,
    });
    expect(
      toPageMeta({ items: [], total: 0, page: 1, perPage: 20 }).totalPages,
    ).toBe(0);
  });
});

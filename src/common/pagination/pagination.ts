import { z } from 'zod';

/** Máximo de itens por página: impede pedidos que leiam a tabela inteira. */
export const MAX_PER_PAGE = 100;
export const DEFAULT_PER_PAGE = 20;
/**
 * Limite de páginas: `OFFSET` enorme obriga o Postgres a ler e descartar
 * todas as linhas anteriores. Ninguém navega para lá da página 10 000.
 */
export const MAX_PAGE = 10_000;

/**
 * `?page&perPage` da query string (chegam como texto → `coerce`).
 * Valores fora dos limites dão 400 em vez de serem corrigidos em silêncio.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number({ error: 'page deve ser um número inteiro' })
    .int('page deve ser um número inteiro')
    .min(1, 'page deve ser ≥ 1')
    .max(MAX_PAGE, `page deve ser ≤ ${MAX_PAGE}`)
    .default(1),
  perPage: z.coerce
    .number({ error: 'perPage deve ser um número inteiro' })
    .int('perPage deve ser um número inteiro')
    .min(1, 'perPage deve ser ≥ 1')
    .max(MAX_PER_PAGE, `perPage deve ser ≤ ${MAX_PER_PAGE}`)
    .default(DEFAULT_PER_PAGE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Resultado paginado devolvido pelos repositórios (sem dependência do ORM). */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

/** `meta` das listas paginadas, tal como no contrato da API. */
export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** Linhas a saltar para chegar à página pedida (`OFFSET`). */
export function pageOffset({ page, perPage }: PaginationQuery): number {
  return (page - 1) * perPage;
}

export function toPageMeta(page: Page<unknown>): PageMeta {
  return {
    page: page.page,
    perPage: page.perPage,
    total: page.total,
    totalPages: Math.ceil(page.total / page.perPage),
  };
}

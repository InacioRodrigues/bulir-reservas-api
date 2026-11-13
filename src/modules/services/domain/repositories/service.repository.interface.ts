import { Page, PaginationQuery } from '@common/pagination/pagination';
import { Service } from '../entities/service.entity';

/** Ordenações suportadas pelo catálogo (`?sort=`). */
export const SERVICE_SORTS = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'name_asc',
] as const;
export type ServiceSort = (typeof SERVICE_SORTS)[number];

/** Critérios de pesquisa. Só devolve serviços ativos (não eliminados). */
export interface ServiceSearchCriteria extends PaginationQuery {
  /** Texto procurado no nome ou na descrição, sem distinguir maiúsculas. */
  search?: string;
  /** Inclusivo, string decimal ("1000.00"). */
  minPrice?: string;
  /** Inclusivo, string decimal ("5000.00"). */
  maxPrice?: string;
  sort: ServiceSort;
  /** Restringe aos serviços de um prestador ("os meus serviços"). */
  providerId?: string;
}

export interface IServiceRepository {
  /** Insere e devolve o serviço com `id`, datas e nome do prestador. */
  create(service: Service): Promise<Service>;
  /** Serviço ativo por id; `null` se não existir ou estiver eliminado. */
  findActiveById(id: string): Promise<Service | null>;
  /**
   * Grava nome, descrição e preço — só se o serviço ainda estiver ativo.
   * Devolve `null` se entretanto foi eliminado (ex.: pedido concorrente).
   */
  update(service: Service): Promise<Service | null>;
  /**
   * Soft delete: preenche `deleted_at` se o serviço estiver ativo.
   * Devolve `false` se já não estava ativo. As reservas continuam a apontar
   * para ele, por isso o histórico mantém-se.
   */
  softDelete(id: string): Promise<boolean>;
  search(criteria: ServiceSearchCriteria): Promise<Page<Service>>;
}

export const SERVICE_REPOSITORY = Symbol('IServiceRepository');

import { randomUUID } from 'node:crypto';
import { Money } from '@common/domain/money';
import { Page, pageOffset } from '@common/pagination/pagination';
import { Service } from '@modules/services/domain/entities/service.entity';
import {
  IServiceRepository,
  ServiceSearchCriteria,
  ServiceSort,
} from '@modules/services/domain/repositories/service.repository.interface';

const byId = (a: Service, b: Service) => a.id.localeCompare(b.id);
const byPrice = (a: Service, b: Service) =>
  Number(Money.parse(a.price).inCents - Money.parse(b.price).inCents);
const byDate = (a: Service, b: Service) =>
  a.createdAt.getTime() - b.createdAt.getTime();

const COMPARATORS: Record<ServiceSort, (a: Service, b: Service) => number> = {
  newest: (a, b) => byDate(b, a) || byId(b, a),
  oldest: (a, b) => byDate(a, b) || byId(a, b),
  price_asc: (a, b) => byPrice(a, b) || byId(a, b),
  price_desc: (a, b) => byPrice(b, a) || byId(b, a),
  name_asc: (a, b) => a.name.localeCompare(b.name) || byId(a, b),
};

/**
 * Repositório em memória com o mesmo comportamento observável do Prisma:
 * gera ids, devolve o nome do prestador, ignora eliminados e aplica
 * pesquisa, filtros de preço (com `Money`, nunca float), ordenação e página.
 */
export class InMemoryServiceRepository implements IServiceRepository {
  readonly items: Service[] = [];
  /** Nomes dos prestadores (na BD vêm da relação com `users`). */
  readonly providerNames = new Map<string, string>();
  private clock = Date.UTC(2026, 0, 1);

  create(service: Service): Promise<Service> {
    // Datas estritamente crescentes para a ordenação ser determinística.
    this.clock += 1000;
    const now = new Date(this.clock);
    const saved = new Service({
      ...service.toObject(),
      id: randomUUID(),
      providerName: this.providerNames.get(service.providerId) ?? 'Prestador',
      createdAt: now,
      updatedAt: now,
    });
    this.items.push(saved);
    return Promise.resolve(this.copy(saved));
  }

  findActiveById(id: string): Promise<Service | null> {
    const found = this.items.find((s) => s.id === id && !s.isDeleted());
    return Promise.resolve(found ? this.copy(found) : null);
  }

  update(service: Service): Promise<Service | null> {
    const index = this.items.findIndex(
      (s) => s.id === service.id && !s.isDeleted(),
    );
    if (index < 0) return Promise.resolve(null);
    this.items[index] = this.copy(service);
    return Promise.resolve(this.copy(service));
  }

  softDelete(id: string): Promise<boolean> {
    const index = this.items.findIndex((s) => s.id === id && !s.isDeleted());
    if (index < 0) return Promise.resolve(false);
    this.items[index] = new Service({
      ...this.items[index].toObject(),
      deletedAt: new Date(),
    });
    return Promise.resolve(true);
  }

  search(criteria: ServiceSearchCriteria): Promise<Page<Service>> {
    const term = criteria.search?.toLowerCase();
    const min = criteria.minPrice ? Money.parse(criteria.minPrice) : null;
    const max = criteria.maxPrice ? Money.parse(criteria.maxPrice) : null;

    const matches = this.items
      .filter((s) => !s.isDeleted())
      .filter(
        (s) => !criteria.providerId || s.providerId === criteria.providerId,
      )
      .filter((s) => !min || Money.parse(s.price).greaterThanOrEqual(min))
      .filter((s) => !max || Money.parse(s.price).lessThanOrEqual(max))
      .filter(
        (s) =>
          !term ||
          s.name.toLowerCase().includes(term) ||
          s.description.toLowerCase().includes(term),
      )
      .sort(COMPARATORS[criteria.sort]);

    const offset = pageOffset(criteria);
    return Promise.resolve({
      items: matches
        .slice(offset, offset + criteria.perPage)
        .map((s) => this.copy(s)),
      total: matches.length,
      page: criteria.page,
      perPage: criteria.perPage,
    });
  }

  /** Cópias: alterar a entidade devolvida não altera o "registo na BD". */
  private copy(service: Service): Service {
    return new Service(service.toObject());
  }
}

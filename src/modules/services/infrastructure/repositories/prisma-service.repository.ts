import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { isRecordNotFound } from '@database/prisma-errors';
import { Page, pageOffset } from '@common/pagination/pagination';
import { Service } from '../../domain/entities/service.entity';
import {
  IServiceRepository,
  ServiceSearchCriteria,
  ServiceSort,
} from '../../domain/repositories/service.repository.interface';
import { ServiceMapper, serviceSelect } from '../prisma/service.mapper';

/**
 * Cada ordenação termina em `id`: sem um desempate único, linhas com o mesmo
 * preço/data podiam trocar de posição entre páginas (repetidas ou em falta).
 */
const ORDER_BY: Record<ServiceSort, Prisma.ServiceOrderByWithRelationInput[]> =
  {
    newest: [{ createdAt: 'desc' }, { id: 'desc' }],
    oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
    price_asc: [{ price: 'asc' }, { id: 'asc' }],
    price_desc: [{ price: 'desc' }, { id: 'desc' }],
    name_asc: [{ name: 'asc' }, { id: 'asc' }],
  };

/**
 * O `contains` do Prisma gera `ILIKE '%' || $1 || '%'` mas não escapa os
 * curingas do próprio texto: pesquisar "%" devolveria tudo e "_" qualquer
 * carácter. Escapamos `\`, `%` e `_` (o `\` é o escape por omissão do
 * `LIKE` no PostgreSQL) para o texto ser procurado literalmente.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class PrismaServiceRepository implements IServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(service: Service): Promise<Service> {
    const saved = await this.prisma.service.create({
      data: ServiceMapper.toCreateInput(service),
      select: serviceSelect,
    });
    return ServiceMapper.toDomain(saved);
  }

  async findActiveById(id: string): Promise<Service | null> {
    const raw = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: serviceSelect,
    });
    return raw ? ServiceMapper.toDomain(raw) : null;
  }

  async update(service: Service): Promise<Service | null> {
    try {
      // `deletedAt: null` no WHERE: se o serviço foi eliminado entre a
      // leitura e esta escrita, o UPDATE não toca em nada (P2025) em vez de
      // "ressuscitar" dados num serviço eliminado.
      const saved = await this.prisma.service.update({
        where: { id: service.id, deletedAt: null },
        data: ServiceMapper.toUpdateInput(service),
        select: serviceSelect,
      });
      return ServiceMapper.toDomain(saved);
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }

  async softDelete(id: string): Promise<boolean> {
    // UPDATE condicional: entre dois DELETE simultâneos só um altera a linha.
    const { count } = await this.prisma.service.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count === 1;
  }

  async search(criteria: ServiceSearchCriteria): Promise<Page<Service>> {
    const where = this.buildWhere(criteria);

    // Página e total num só round-trip à BD.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        select: serviceSelect,
        orderBy: ORDER_BY[criteria.sort],
        skip: pageOffset(criteria),
        take: criteria.perPage,
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      items: rows.map((row) => ServiceMapper.toDomain(row)),
      total,
      page: criteria.page,
      perPage: criteria.perPage,
    };
  }

  /**
   * Filtros construídos pelo Prisma → SQL parametrizado (`$1`, `$2`, …): o
   * texto de pesquisa nunca é concatenado na query (sem SQL injection).
   */
  private buildWhere(
    criteria: ServiceSearchCriteria,
  ): Prisma.ServiceWhereInput {
    const where: Prisma.ServiceWhereInput = { deletedAt: null };

    if (criteria.providerId) {
      where.providerId = criteria.providerId;
    }
    if (criteria.minPrice !== undefined || criteria.maxPrice !== undefined) {
      where.price = {
        ...(criteria.minPrice !== undefined && { gte: criteria.minPrice }),
        ...(criteria.maxPrice !== undefined && { lte: criteria.maxPrice }),
      };
    }
    if (criteria.search) {
      const term = escapeLikePattern(criteria.search);
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return where;
  }
}

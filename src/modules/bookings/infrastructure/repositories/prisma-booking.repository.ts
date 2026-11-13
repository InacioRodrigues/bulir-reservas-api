import { Prisma } from '@prisma/client';
import { Page, pageOffset } from '@common/pagination/pagination';
import { PrismaDb } from '@database/prisma-unit-of-work';
import { Booking } from '../../domain/entities/booking.entity';
import { BookingStatus } from '../../domain/entities/booking-status';
import {
  BookingSearchCriteria,
  IBookingRepository,
} from '../../domain/repositories/booking.repository.interface';
import { BookingMapper, bookingSelect } from '../prisma/booking.mapper';

/**
 * Reservas sobre PostgreSQL. Recebe o cliente Prisma a usar: dentro de uma
 * transação é o `tx` (ver `PrismaUnitOfWork`), fora dela o `PrismaService`.
 */
export class PrismaBookingRepository implements IBookingRepository {
  constructor(private readonly db: PrismaDb) {}

  async create(booking: Booking): Promise<Booking> {
    const saved = await this.db.booking.create({
      data: BookingMapper.toCreateInput(booking),
      select: bookingSelect,
    });
    return BookingMapper.toDomain(saved);
  }

  async findById(id: string): Promise<Booking | null> {
    const raw = await this.db.booking.findUnique({
      where: { id },
      select: bookingSelect,
    });
    return raw ? BookingMapper.toDomain(raw) : null;
  }

  async cancelIfConfirmed(
    id: string,
    cancelledById: string,
  ): Promise<Booking | null> {
    // UPDATE condicional: o estado é verificado e alterado na mesma
    // instrução. Um segundo cancelamento concorrente espera pelo lock da
    // linha e, depois do COMMIT do primeiro, já não encontra CONFIRMED.
    const { count } = await this.db.booking.updateMany({
      where: { id, status: BookingStatus.CONFIRMED },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById,
      },
    });
    if (count !== 1) {
      return null;
    }
    return this.findById(id);
  }

  async search(criteria: BookingSearchCriteria): Promise<Page<Booking>> {
    const where: Prisma.BookingWhereInput = {
      ...('clientId' in criteria
        ? { clientId: criteria.clientId }
        : { providerId: criteria.providerId }),
      ...(criteria.status && { status: criteria.status }),
    };

    // Página (com os nomes carregados em lote, sem N+1) e total, em paralelo.
    // Ordem pelo índice (client_id|provider_id, created_at DESC); `id` desempata.
    const [rows, total] = await Promise.all([
      this.db.booking.findMany({
        where,
        select: bookingSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pageOffset(criteria),
        take: criteria.perPage,
      }),
      this.db.booking.count({ where }),
    ]);

    return {
      items: rows.map((row) => BookingMapper.toDomain(row)),
      total,
      page: criteria.page,
      perPage: criteria.perPage,
    };
  }
}

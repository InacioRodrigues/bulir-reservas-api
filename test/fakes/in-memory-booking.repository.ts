import { randomUUID } from 'node:crypto';
import { Page, pageOffset } from '@common/pagination/pagination';
import { Booking } from '@modules/bookings/domain/entities/booking.entity';
import { BookingStatus } from '@modules/bookings/domain/entities/booking-status';
import {
  BookingSearchCriteria,
  IBookingRepository,
} from '@modules/bookings/domain/repositories/booking.repository.interface';
import { UndoLog } from './fake-unit-of-work';

/** "Tabela" `bookings` + nomes dos utilizadores (o JOIN com `users`). */
export class InMemoryBookingStore {
  readonly items: Booking[] = [];
  readonly userNames = new Map<string, string>();
  clock = Date.UTC(2026, 0, 1);
}

/**
 * Reservas em memória com o comportamento observável do Prisma: gera id e
 * data, devolve nomes de cliente/prestador e o cancelamento é condicional
 * ao estado (só uma chamada concorrente vence).
 */
export class InMemoryBookingRepository implements IBookingRepository {
  constructor(
    readonly store = new InMemoryBookingStore(),
    private readonly undo?: UndoLog,
  ) {}

  withUndo(undo: UndoLog): InMemoryBookingRepository {
    return new InMemoryBookingRepository(this.store, undo);
  }

  get items(): Booking[] {
    return this.store.items;
  }

  create(booking: Booking): Promise<Booking> {
    this.store.clock += 1000;
    const saved = new Booking({
      ...booking.toObject(),
      id: randomUUID(),
      clientName: this.store.userNames.get(booking.clientId) ?? 'Cliente',
      providerName: this.store.userNames.get(booking.providerId) ?? 'Prestador',
      createdAt: new Date(this.store.clock),
    });
    this.store.items.push(saved);
    this.undo?.push(() => {
      this.store.items.splice(this.store.items.indexOf(saved), 1);
    });
    return Promise.resolve(this.copy(saved));
  }

  findById(id: string): Promise<Booking | null> {
    const found = this.store.items.find((b) => b.id === id);
    return Promise.resolve(found ? this.copy(found) : null);
  }

  cancelIfConfirmed(
    id: string,
    cancelledById: string,
  ): Promise<Booking | null> {
    const index = this.store.items.findIndex(
      (b) => b.id === id && b.status === BookingStatus.CONFIRMED,
    );
    if (index < 0) return Promise.resolve(null);

    const previous = this.store.items[index];
    const cancelled = new Booking({
      ...previous.toObject(),
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledById,
    });
    this.store.items[index] = cancelled;
    this.undo?.push(() => {
      this.store.items[this.store.items.indexOf(cancelled)] = previous;
    });
    return Promise.resolve(this.copy(cancelled));
  }

  search(criteria: BookingSearchCriteria): Promise<Page<Booking>> {
    const matches = this.store.items
      .filter((b) =>
        'clientId' in criteria
          ? b.clientId === criteria.clientId
          : b.providerId === criteria.providerId,
      )
      .filter((b) => !criteria.status || b.status === criteria.status)
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      );
    const offset = pageOffset(criteria);
    return Promise.resolve({
      items: matches
        .slice(offset, offset + criteria.perPage)
        .map((b) => this.copy(b)),
      total: matches.length,
      page: criteria.page,
      perPage: criteria.perPage,
    });
  }

  private copy(booking: Booking): Booking {
    return new Booking(booking.toObject());
  }
}

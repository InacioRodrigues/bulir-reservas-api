import { UserRole } from '@modules/users/domain/entities/user-role';
import { Service } from '@modules/services/domain/entities/service.entity';
import { BookingStatus } from './booking-status';

export interface BookingProps {
  id?: string;
  clientId: string;
  /** Preenchido pelo repositório nas leituras (JOIN com `users`). */
  clientName?: string;
  /** Snapshot: o prestador do serviço no momento da reserva. */
  providerId: string;
  providerName?: string;
  serviceId: string;
  /** Snapshot do nome do serviço no momento da reserva. */
  serviceName: string;
  /** Snapshot do preço pago (string decimal, 2 casas). */
  price: string;
  status?: BookingStatus;
  cancelledAt?: Date | null;
  cancelledById?: string | null;
  createdAt?: Date;
}

/**
 * Reserva de um serviço por um cliente.
 *
 * Guarda uma cópia (snapshot) do nome, do preço e do prestador do serviço:
 * se o prestador editar ou eliminar o serviço depois, o histórico continua a
 * mostrar o que foi efetivamente contratado, e o reembolso usa o preço pago.
 */
export class Booking {
  private readonly props: Required<
    Omit<BookingProps, 'clientName' | 'providerName'>
  > &
    Pick<BookingProps, 'clientName' | 'providerName'>;

  constructor(props: BookingProps) {
    this.props = {
      id: props.id ?? '',
      clientId: props.clientId,
      clientName: props.clientName,
      providerId: props.providerId,
      providerName: props.providerName,
      serviceId: props.serviceId,
      serviceName: props.serviceName,
      price: props.price,
      status: props.status ?? BookingStatus.CONFIRMED,
      cancelledAt: props.cancelledAt ?? null,
      cancelledById: props.cancelledById ?? null,
      createdAt: props.createdAt ?? new Date(),
    };
  }

  /** Nova reserva confirmada, com o snapshot do serviço tal como está agora. */
  static create(data: { clientId: string; service: Service }): Booking {
    return new Booking({
      clientId: data.clientId,
      providerId: data.service.providerId,
      serviceId: data.service.id,
      serviceName: data.service.name,
      price: data.service.price,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get clientId(): string {
    return this.props.clientId;
  }
  get clientName(): string | undefined {
    return this.props.clientName;
  }
  get providerId(): string {
    return this.props.providerId;
  }
  get providerName(): string | undefined {
    return this.props.providerName;
  }
  get serviceId(): string {
    return this.props.serviceId;
  }
  get serviceName(): string {
    return this.props.serviceName;
  }
  get price(): string {
    return this.props.price;
  }
  get status(): BookingStatus {
    return this.props.status;
  }
  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }
  get cancelledById(): string | null {
    return this.props.cancelledById;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Participa quem reservou (cliente) e quem presta o serviço (prestador). */
  isParticipant(userId: string): boolean {
    return this.props.clientId === userId || this.props.providerId === userId;
  }

  isCancelled(): boolean {
    return this.props.status === BookingStatus.CANCELLED;
  }

  /** Papel de quem cancelou (o contrato expõe o papel, não o id). */
  cancelledByRole(): UserRole | null {
    if (!this.props.cancelledById) return null;
    return this.props.cancelledById === this.props.clientId
      ? UserRole.CLIENT
      : UserRole.PROVIDER;
  }

  toObject(): BookingProps {
    return { ...this.props };
  }
}

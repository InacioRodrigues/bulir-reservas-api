import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@common/exceptions';

/** 404 — a reserva não existe. */
export class BookingNotFoundError extends NotFoundException {
  constructor() {
    super('Reserva não encontrada');
  }
}

/** 403 — só clientes reservam serviços. */
export class ClientOnlyBookingError extends ForbiddenException {
  constructor() {
    super('Só clientes podem reservar serviços');
  }
}

/** 403 — ninguém reserva um serviço que é seu (também `CHECK` na BD). */
export class CannotBookOwnServiceError extends ForbiddenException {
  constructor() {
    super('Não pode reservar um serviço publicado por si');
  }
}

/** 403 — o utilizador não é o cliente nem o prestador desta reserva. */
export class NotBookingParticipantError extends ForbiddenException {
  constructor() {
    super('Só o cliente ou o prestador da reserva têm acesso a ela');
  }
}

/** 409 — a reserva já tinha sido cancelada (por este ou por outro pedido). */
export class BookingAlreadyCancelledError extends ConflictException {
  constructor() {
    super('Esta reserva já foi cancelada', 'BOOKING_ALREADY_CANCELLED');
  }
}

/** 409 — o prestador já não tem saldo para devolver o valor ao cliente. */
export class ProviderInsufficientBalanceError extends ConflictException {
  constructor() {
    super(
      'O prestador não tem saldo suficiente para reembolsar esta reserva',
      'PROVIDER_INSUFFICIENT_BALANCE',
    );
  }
}

import { ConflictException, ForbiddenException } from '@common/exceptions';

/** 409 — o cliente não tem saldo para pagar a reserva. */
export class InsufficientBalanceError extends ConflictException {
  constructor() {
    super(
      'Saldo insuficiente para reservar este serviço',
      'INSUFFICIENT_BALANCE',
    );
  }
}

/** 403 — só clientes carregam saldo (o prestador recebe pelas reservas). */
export class TopUpClientOnlyError extends ForbiddenException {
  constructor() {
    super('Só clientes podem carregar saldo');
  }
}

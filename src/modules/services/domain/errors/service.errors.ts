import { ForbiddenException, NotFoundException } from '@common/exceptions';

/** 404 — o serviço não existe ou foi eliminado (soft delete). */
export class ServiceNotFoundError extends NotFoundException {
  constructor() {
    super('Serviço não encontrado');
  }
}

/** 403 — o utilizador autenticado não é o prestador que publicou o serviço. */
export class NotServiceOwnerError extends ForbiddenException {
  constructor() {
    super('Só o prestador que publicou o serviço o pode alterar ou eliminar');
  }
}

/** 403 — operação reservada a prestadores de serviço. */
export class ProviderOnlyError extends ForbiddenException {
  constructor() {
    super('Só prestadores de serviço podem gerir serviços');
  }
}

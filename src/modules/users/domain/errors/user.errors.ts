import { ConflictException } from '@common/exceptions';

/** 409 — já existe uma conta com este e-mail (comparação sem maiúsculas). */
export class EmailAlreadyExistsError extends ConflictException {
  constructor() {
    super('Já existe uma conta com este e-mail', 'EMAIL_ALREADY_EXISTS');
  }
}

/** 409 — já existe uma conta com este NIF. */
export class NifAlreadyExistsError extends ConflictException {
  constructor() {
    super('Já existe uma conta com este NIF', 'NIF_ALREADY_EXISTS');
  }
}

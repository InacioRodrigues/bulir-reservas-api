import { UnauthorizedException } from '@common/exceptions';

/**
 * 401 genérico do login: a mesma resposta para "utilizador não existe" e
 * "password errada", para não revelar que e-mails/NIFs estão registados.
 */
export class InvalidCredentialsError extends UnauthorizedException {
  constructor() {
    super('Credenciais inválidas', 'INVALID_CREDENTIALS');
  }
}

/** 401 — refresh token inválido, expirado, revogado ou reutilizado. */
export class InvalidRefreshTokenError extends UnauthorizedException {
  constructor() {
    super('Sessão inválida ou expirada. Inicie sessão novamente');
  }
}

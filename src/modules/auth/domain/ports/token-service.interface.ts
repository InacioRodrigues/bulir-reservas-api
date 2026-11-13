import { UserRole } from '@modules/users/domain/entities/user-role';

/** Conteúdo do access token: só o necessário para autorizar (sem dados pessoais). */
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface SignedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Porta para emissão/validação de tokens. Os use cases não sabem que por
 * baixo está JWT — só que há um token de acesso curto e um de renovação longo.
 */
export interface ITokenService {
  signAccessToken(payload: AccessTokenPayload): string;
  signRefreshToken(userId: string): SignedRefreshToken;
  /** Devolve o `sub` se a assinatura e a validade forem corretas; senão `null`. */
  verifyRefreshToken(token: string): { sub: string } | null;
}

export const TOKEN_SERVICE = Symbol('ITokenService');

import {
  AccessTokenPayload,
  ITokenService,
  SignedRefreshToken,
} from '@modules/auth/domain/ports/token-service.interface';

/** Tokens legíveis e previsíveis: `access:<sub>:<role>` e `refresh:<sub>:<n>`. */
export class FakeTokenService implements ITokenService {
  private counter = 0;
  /** Tokens que o teste quer tratar como mal assinados/expirados. */
  readonly invalid = new Set<string>();

  signAccessToken(payload: AccessTokenPayload): string {
    return `access:${payload.sub}:${payload.role}`;
  }

  signRefreshToken(userId: string): SignedRefreshToken {
    this.counter += 1;
    return {
      token: `refresh:${userId}:${this.counter}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    };
  }

  verifyRefreshToken(token: string): { sub: string } | null {
    if (this.invalid.has(token) || !token.startsWith('refresh:')) return null;
    return { sub: token.split(':')[1] };
  }
}

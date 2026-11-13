import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import {
  AccessTokenPayload,
  ITokenService,
  SignedRefreshToken,
} from '../../domain/ports/token-service.interface';

/**
 * Implementação JWT (HS256). Access e refresh usam segredos DIFERENTES:
 * um refresh token nunca é aceite como access token e vice-versa.
 */
@Injectable()
export class JwtTokenService implements ITokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(
      { sub: payload.sub, role: payload.role },
      {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>(
          'jwt.accessExpiration',
          '15m',
        ) as any,
      },
    );
  }

  signRefreshToken(userId: string): SignedRefreshToken {
    const token = this.jwt.sign(
      // `jti` aleatório: dois logins no mesmo segundo gerariam tokens iguais
      // (mesmo sub/iat/exp) e colidiriam no UNIQUE da tabela.
      { sub: userId, jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>(
          'jwt.refreshExpiration',
          '7d',
        ) as any,
      },
    );
    // A expiração guardada na BD vem do próprio token (`exp`), em vez de
    // reinterpretar a string de configuração ("7d", "12h", ...).
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  verifyRefreshToken(token: string): { sub: string } | null {
    try {
      const { sub } = this.jwt.verify<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
      return { sub };
    } catch {
      return null;
    }
  }
}

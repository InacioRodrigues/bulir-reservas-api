import { Inject, Injectable } from '@nestjs/common';
import { User } from '@modules/users/domain/entities/user.entity';
import {
  ITokenService,
  TOKEN_SERVICE,
} from '../../domain/ports/token-service.interface';
import {
  IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from '../../domain/repositories/refresh-token.repository.interface';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Abre uma sessão: access token curto (15 min, sem estado) + refresh token
 * longo guardado na BD (com estado → pode ser revogado no logout/rotação).
 */
@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
  ) {}

  async issue(user: User): Promise<SessionTokens> {
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
    });
    const refresh = this.tokens.signRefreshToken(user.id);

    await this.refreshTokens.create({
      token: refresh.token,
      userId: user.id,
      expiresAt: refresh.expiresAt,
    });

    return { accessToken, refreshToken: refresh.token };
  }
}

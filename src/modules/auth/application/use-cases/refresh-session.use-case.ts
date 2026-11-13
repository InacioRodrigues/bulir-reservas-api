import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '@modules/users/domain/repositories/user.repository.interface';
import {
  ITokenService,
  TOKEN_SERVICE,
} from '../../domain/ports/token-service.interface';
import {
  IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from '../../domain/repositories/refresh-token.repository.interface';
import { InvalidRefreshTokenError } from '../../domain/errors/auth.errors';
import { SessionIssuer, SessionTokens } from '../services/session-issuer';

/**
 * Rotação de refresh token: cada token só pode ser usado UMA vez.
 *
 * Se um token já usado voltar a aparecer, alguém o copiou (ex.: roubo de
 * token): revogamos todas as sessões do utilizador e obrigamos a novo login.
 */
@Injectable()
export class RefreshSessionUseCase {
  private readonly logger = new Logger(RefreshSessionUseCase.name);

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(refreshToken: string): Promise<SessionTokens> {
    // 1. Assinatura e expiração do JWT.
    if (!this.tokens.verifyRefreshToken(refreshToken)) {
      throw new InvalidRefreshTokenError();
    }

    // 2. Tem de existir na BD (o logout apaga-o).
    const record = await this.refreshTokens.findByToken(refreshToken);
    if (!record || record.expiresAt <= new Date()) {
      throw new InvalidRefreshTokenError();
    }

    // 3. Revogação condicional: se já estava revogado, ou se um pedido
    //    concorrente o revogou primeiro, é reutilização → fechar tudo.
    const revokedNow =
      !record.isRevoked && (await this.refreshTokens.revokeIfActive(record.id));
    if (!revokedNow) {
      await this.refreshTokens.revokeAllForUser(record.userId);
      this.logger.warn(
        `Refresh token reutilizado (user ${record.userId}): todas as sessões revogadas`,
      );
      throw new InvalidRefreshTokenError();
    }

    // 4. Nova sessão com dados atuais do utilizador (ex.: papel).
    const user = await this.users.findById(record.userId);
    if (!user) {
      throw new InvalidRefreshTokenError();
    }
    return this.sessions.issue(user);
  }
}

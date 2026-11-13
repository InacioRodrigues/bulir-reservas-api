import { Inject, Injectable } from '@nestjs/common';
import {
  IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from '../../domain/repositories/refresh-token.repository.interface';

/**
 * Termina a sessão apagando o refresh token. Só apaga tokens do próprio
 * utilizador; é idempotente (token desconhecido → 204 na mesma).
 * O access token continua válido até expirar (≤ 15 min) — compromisso
 * aceite em troca de não consultar uma lista negra em cada pedido.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
  ) {}

  execute(userId: string, refreshToken: string): Promise<void> {
    return this.refreshTokens.deleteForUser(refreshToken, userId);
  }
}

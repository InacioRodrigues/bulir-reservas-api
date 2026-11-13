export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  isRevoked: boolean;
}

/**
 * Sessões de renovação persistidas. A implementação guarda apenas um hash do
 * token: quem ler a BD (backup, fuga de dados) não fica com sessões válidas.
 */
export interface IRefreshTokenRepository {
  create(data: {
    token: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void>;
  findByToken(token: string): Promise<RefreshTokenRecord | null>;
  /**
   * Revoga só se ainda estiver ativo (UPDATE ... WHERE is_revoked = false).
   * Devolve `false` se outro pedido já o revogou — é assim que detetamos
   * dois refresh concorrentes com o mesmo token.
   */
  revokeIfActive(id: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<void>;
  deleteForUser(token: string, userId: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('IRefreshTokenRepository');

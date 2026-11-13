import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '@database/prisma.service';
import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
} from '../../domain/repositories/refresh-token.repository.interface';

/**
 * Guarda SHA-256 do token, nunca o token em claro (como uma password, mas sem
 * salt/argon2: o token já tem alta entropia, por isso um hash rápido basta e
 * permite procurar por igualdade com o índice UNIQUE).
 */
const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    token: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        token: digest(data.token),
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    });
  }

  findByToken(token: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token: digest(token) },
      select: { id: true, userId: true, expiresAt: true, isRevoked: true },
    });
  }

  async revokeIfActive(id: string): Promise<boolean> {
    // UPDATE ... WHERE id = $1 AND is_revoked = false: atómico na BD.
    // Entre dois pedidos concorrentes, só um obtém count = 1.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, isRevoked: false },
      data: { isRevoked: true },
    });
    return count === 1;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async deleteForUser(token: string, userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: digest(token), userId },
    });
  }
}

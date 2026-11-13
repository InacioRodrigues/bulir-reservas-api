import { randomUUID } from 'node:crypto';
import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
} from '@modules/auth/domain/repositories/refresh-token.repository.interface';

type StoredToken = RefreshTokenRecord & { token: string };

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  readonly items: StoredToken[] = [];

  create(data: { token: string; userId: string; expiresAt: Date }) {
    this.items.push({ ...data, id: randomUUID(), isRevoked: false });
    return Promise.resolve();
  }

  findByToken(token: string) {
    const found = this.items.find((t) => t.token === token);
    return Promise.resolve(found ? { ...found } : null);
  }

  revokeIfActive(id: string) {
    const found = this.items.find((t) => t.id === id && !t.isRevoked);
    if (found) found.isRevoked = true;
    return Promise.resolve(Boolean(found));
  }

  revokeAllForUser(userId: string) {
    this.items
      .filter((t) => t.userId === userId)
      .forEach((t) => (t.isRevoked = true));
    return Promise.resolve();
  }

  deleteForUser(token: string, userId: string) {
    const index = this.items.findIndex(
      (t) => t.token === token && t.userId === userId,
    );
    if (index >= 0) this.items.splice(index, 1);
    return Promise.resolve();
  }
}

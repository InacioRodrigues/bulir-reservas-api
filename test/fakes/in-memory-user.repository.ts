import { randomUUID } from 'node:crypto';
import { IUserRepository } from '@modules/users/domain/repositories/user.repository.interface';
import { User } from '@modules/users/domain/entities/user.entity';
import {
  EmailAlreadyExistsError,
  NifAlreadyExistsError,
} from '@modules/users/domain/errors/user.errors';

/**
 * Repositório em memória para testes unitários dos use cases.
 * Reproduz o comportamento relevante da BD: gera o id e aplica os UNIQUE de
 * e-mail e NIF (tal como o repositório Prisma ao traduzir o `P2002`).
 */
export class InMemoryUserRepository implements IUserRepository {
  readonly items: User[] = [];

  create(user: User): Promise<User> {
    if (this.items.some((u) => u.email === user.email)) {
      return Promise.reject(new EmailAlreadyExistsError());
    }
    if (this.items.some((u) => u.nif === user.nif)) {
      return Promise.reject(new NifAlreadyExistsError());
    }
    const saved = new User({ ...user.toObject(), id: randomUUID() });
    this.items.push(saved);
    return Promise.resolve(saved);
  }

  update(user: User): Promise<User> {
    const index = this.items.findIndex((u) => u.id === user.id);
    this.items[index] = user;
    return Promise.resolve(user);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.items.find((u) => u.id === id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.items.find((u) => u.email === email) ?? null);
  }

  findByNif(nif: string): Promise<User | null> {
    return Promise.resolve(this.items.find((u) => u.nif === nif) ?? null);
  }
}

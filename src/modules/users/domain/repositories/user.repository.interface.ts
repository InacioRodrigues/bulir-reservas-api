import { User } from '../entities/user.entity';

export interface IUserRepository {
  create(user: User): Promise<User>;
  /** Persiste apenas campos de perfil (ex.: password). Nunca escreve o saldo. */
  update(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByNif(nif: string): Promise<User | null>;
}

export const USER_REPOSITORY_TOKEN = Symbol('IUserRepository');

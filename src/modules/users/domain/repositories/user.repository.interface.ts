import { User } from '../entities/user.entity';

export interface IUserRepository {
  /**
   * @throws EmailAlreadyExistsError | NifAlreadyExistsError se a BD rejeitar
   * o INSERT por duplicado (ex.: dois registos concorrentes).
   */
  create(user: User): Promise<User>;
  /** Persiste apenas campos de perfil (ex.: password). Nunca escreve o saldo. */
  update(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  /** Espera o e-mail já normalizado (ver `normalizeEmail`). */
  findByEmail(email: string): Promise<User | null>;
  /** Espera o NIF já normalizado (ver `normalizeNif`). */
  findByNif(nif: string): Promise<User | null>;
}

export const USER_REPOSITORY_TOKEN = Symbol('IUserRepository');

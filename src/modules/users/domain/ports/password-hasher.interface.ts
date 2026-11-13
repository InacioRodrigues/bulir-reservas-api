/**
 * Porta para hashing de passwords. Os use cases dependem desta interface e
 * não do argon2 diretamente (DIP): em produção usamos argon2id; nos testes
 * unitários um hasher falso e instantâneo.
 */
export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  /** Nunca lança: um hash corrompido conta como password errada. */
  verify(plain: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('IPasswordHasher');

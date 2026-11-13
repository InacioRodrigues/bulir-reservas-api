import { IPasswordHasher } from '@modules/users/domain/ports/password-hasher.interface';

/** Hasher determinístico e instantâneo: os testes não pagam o custo do argon2. */
export class FakePasswordHasher implements IPasswordHasher {
  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}

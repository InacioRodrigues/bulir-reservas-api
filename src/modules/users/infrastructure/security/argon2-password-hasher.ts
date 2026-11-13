import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { IPasswordHasher } from '../../domain/ports/password-hasher.interface';

/**
 * argon2id (vencedor da Password Hashing Competition): lento de propósito e
 * exigente em memória, o que torna ataques de força bruta com GPU caros.
 * O salt é aleatório e fica guardado dentro do próprio hash.
 */
@Injectable()
export class Argon2PasswordHasher implements IPasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}

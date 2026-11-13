import * as argon2 from 'argon2';

export class PasswordHelper {
  static async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}

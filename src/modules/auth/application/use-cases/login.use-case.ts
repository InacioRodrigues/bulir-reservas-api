import { Inject, Injectable } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '@modules/users/domain/repositories/user.repository.interface';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@modules/users/domain/ports/password-hasher.interface';
import { User } from '@modules/users/domain/entities/user.entity';
import {
  isEmailIdentifier,
  normalizeEmail,
  normalizeNif,
} from '@modules/users/domain/user-identity';
import { InvalidCredentialsError } from '../../domain/errors/auth.errors';
import { LoginDto } from '../dto/auth.dto';
import { SessionIssuer } from '../services/session-issuer';
import { AuthResult } from './register.use-case';

/** Login por e-mail OU NIF: se o identificador tiver "@" é e-mail, senão NIF. */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResult> {
    const user = await this.findByIdentifier(dto.identifier);

    if (!user) {
      // Gastar o mesmo tempo que uma verificação real: sem isto, "conta não
      // existe" responde muito mais depressa e o tempo de resposta revelaria
      // que e-mails/NIFs estão registados (enumeração por timing).
      await this.passwordHasher.hash(dto.password);
      throw new InvalidCredentialsError();
    }

    const valid = await this.passwordHasher.verify(
      dto.password,
      user.passwordHash,
    );
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const tokens = await this.sessions.issue(user);
    return { user, ...tokens };
  }

  private findByIdentifier(identifier: string): Promise<User | null> {
    return isEmailIdentifier(identifier)
      ? this.users.findByEmail(normalizeEmail(identifier))
      : this.users.findByNif(normalizeNif(identifier));
  }
}

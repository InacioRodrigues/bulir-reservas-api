import { Injectable } from '@nestjs/common';
import { CreateUserUseCase } from '@modules/users/application/use-cases/create-user.use-case';
import { User } from '@modules/users/domain/entities/user.entity';
import { RegisterDto } from '../dto/auth.dto';
import { SessionIssuer, SessionTokens } from '../services/session-issuer';

export interface AuthResult extends SessionTokens {
  user: User;
}

/**
 * Registo = criar a conta (regras de unicidade no módulo de utilizadores)
 * + abrir sessão logo de seguida, para o cliente não ter de fazer login.
 */
@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.createUser.execute(dto);
    const tokens = await this.sessions.issue(user);
    return { user, ...tokens };
  }
}

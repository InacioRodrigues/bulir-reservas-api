import { Module } from '@nestjs/common';
import { USER_REPOSITORY_TOKEN } from './domain/repositories/user.repository.interface';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.interface';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';

/**
 * Sem controller próprio: o utilizador é criado em `POST /auth/register` e
 * consultado em `GET /auth/me`.
 */
@Module({
  providers: [
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    CreateUserUseCase,
    GetUserUseCase,
  ],
  exports: [
    USER_REPOSITORY_TOKEN,
    PASSWORD_HASHER,
    CreateUserUseCase,
    GetUserUseCase,
  ],
})
export class UsersModule {}
export { USER_REPOSITORY_TOKEN };
export type { IUserRepository } from './domain/repositories/user.repository.interface';

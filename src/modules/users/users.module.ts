import { Module } from '@nestjs/common';
import { USER_REPOSITORY_TOKEN } from './domain/repositories/user.repository.interface';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';

/**
 * Sem controller próprio: o utilizador é criado em `POST /auth/register` e
 * consultado em `GET /auth/me`. Não há papel ADMIN neste domínio.
 */
@Module({
  providers: [
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserRepository,
    },
    CreateUserUseCase,
    GetUserUseCase,
  ],
  exports: [USER_REPOSITORY_TOKEN, CreateUserUseCase, GetUserUseCase],
})
export class UsersModule {}
export { USER_REPOSITORY_TOKEN };
export type { IUserRepository } from './domain/repositories/user.repository.interface';

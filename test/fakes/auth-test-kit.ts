import { CreateUserUseCase } from '@modules/users/application/use-cases/create-user.use-case';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { SessionIssuer } from '@modules/auth/application/services/session-issuer';
import { InMemoryUserRepository } from './in-memory-user.repository';
import { InMemoryRefreshTokenRepository } from './in-memory-refresh-token.repository';
import { FakePasswordHasher } from './fake-password-hasher';
import { FakeTokenService } from './fake-token.service';

/** Monta as dependências reais dos use cases de auth sobre fakes em memória. */
export function createAuthTestKit() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenService();
  const sessions = new SessionIssuer(tokens, refreshTokens);
  const createUser = new CreateUserUseCase(users, hasher);

  const seedUser = (
    overrides: Partial<Parameters<CreateUserUseCase['execute']>[0]> = {},
  ) =>
    createUser.execute({
      fullName: 'Ana Paula Domingos',
      nif: '004512345LA041',
      email: 'ana@bulir.ao',
      password: 'Senha123',
      role: UserRole.CLIENT,
      ...overrides,
    });

  return {
    users,
    refreshTokens,
    hasher,
    tokens,
    sessions,
    createUser,
    seedUser,
  };
}

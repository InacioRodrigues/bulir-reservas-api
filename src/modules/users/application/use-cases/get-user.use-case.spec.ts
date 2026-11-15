import { NotFoundException } from '@common/exceptions';
import { InMemoryUserRepository } from '@test/fakes/in-memory-user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/entities/user-role';
import { GetUserUseCase } from './get-user.use-case';

describe('GetUserUseCase', () => {
  const setup = async () => {
    const users = new InMemoryUserRepository();
    const saved = await users.create(
      new User({
        fullName: 'Bruno Prestador',
        nif: '987654321LA042',
        email: 'bruno@exemplo.ao',
        passwordHash: 'hash',
        role: UserRole.PROVIDER,
      }),
    );
    return { useCase: new GetUserUseCase(users), saved };
  };

  it('devolve o utilizador (usado por GET /auth/me, com o saldo atual)', async () => {
    const { useCase, saved } = await setup();

    await expect(useCase.execute(saved.id)).resolves.toBe(saved);
  });

  it('404 quando a conta já não existe (token de um utilizador apagado)', async () => {
    const { useCase } = await setup();

    await expect(useCase.execute('nao-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

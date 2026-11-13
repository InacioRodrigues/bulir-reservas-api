import { LoginUseCase } from './login.use-case';
import { InvalidCredentialsError } from '../../domain/errors/auth.errors';
import { createAuthTestKit } from '@test/fakes/auth-test-kit';

describe('LoginUseCase', () => {
  const setup = async () => {
    const kit = createAuthTestKit();
    const user = await kit.seedUser();
    const useCase = new LoginUseCase(kit.users, kit.hasher, kit.sessions);
    return { kit, user, useCase };
  };

  it('autentica por e-mail (sem distinguir maiúsculas)', async () => {
    const { user, useCase } = await setup();

    const result = await useCase.execute({
      identifier: '  ANA@bulir.ao ',
      password: 'Senha123',
    });

    expect(result.user.id).toBe(user.id);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('autentica por NIF (normalizado: minúsculas e espaços)', async () => {
    const { user, useCase } = await setup();

    const result = await useCase.execute({
      identifier: '004 512 345 la041',
      password: 'Senha123',
    });

    expect(result.user.id).toBe(user.id);
  });

  it('password errada → 401 INVALID_CREDENTIALS', async () => {
    const { useCase, kit } = await setup();

    await expect(
      useCase.execute({ identifier: 'ana@bulir.ao', password: 'Errada123' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
    expect(kit.refreshTokens.items).toHaveLength(0);
  });

  it('utilizador inexistente → o MESMO 401 (não revela se a conta existe)', async () => {
    const { useCase, kit } = await setup();
    const hashSpy = jest.spyOn(kit.hasher, 'hash');

    const byEmail = useCase.execute({
      identifier: 'nao.existe@bulir.ao',
      password: 'Senha123',
    });
    await expect(byEmail).rejects.toBeInstanceOf(InvalidCredentialsError);

    await expect(
      useCase.execute({ identifier: '999999999XX999', password: 'Senha123' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    // Mesmo sem conta, gasta-se o custo de um hash (mitiga enumeração por tempo).
    expect(hashSpy).toHaveBeenCalledTimes(2);
  });

  it('um NIF nunca é procurado como e-mail e vice-versa', async () => {
    const { useCase, kit } = await setup();
    const byEmail = jest.spyOn(kit.users, 'findByEmail');
    const byNif = jest.spyOn(kit.users, 'findByNif');

    await useCase.execute({
      identifier: '004512345LA041',
      password: 'Senha123',
    });
    expect(byNif).toHaveBeenCalledWith('004512345LA041');
    expect(byEmail).not.toHaveBeenCalled();
  });
});

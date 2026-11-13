import { RegisterUseCase } from './register.use-case';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { createAuthTestKit } from '@test/fakes/auth-test-kit';

describe('RegisterUseCase', () => {
  const dto = {
    fullName: 'Carla Prestadora',
    nif: '5417001234',
    email: 'Carla@Bulir.ao',
    password: 'Senha123',
    role: UserRole.PROVIDER,
  };

  it('cria a conta e devolve { user, accessToken, refreshToken }', async () => {
    const kit = createAuthTestKit();
    const useCase = new RegisterUseCase(kit.createUser, kit.sessions);

    const result = await useCase.execute(dto);

    expect(result.user.email).toBe('carla@bulir.ao');
    expect(result.user.role).toBe(UserRole.PROVIDER);
    expect(result.accessToken).toBe(`access:${result.user.id}:PROVIDER`);
    expect(result.refreshToken).toBeTruthy();
    // O refresh token fica registado (para poder ser rodado/revogado).
    expect(kit.refreshTokens.items).toHaveLength(1);
    expect(kit.refreshTokens.items[0].userId).toBe(result.user.id);
  });

  it('não abre sessão se o registo falhar (e-mail duplicado)', async () => {
    const kit = createAuthTestKit();
    const useCase = new RegisterUseCase(kit.createUser, kit.sessions);
    await useCase.execute(dto);

    await expect(
      useCase.execute({ ...dto, nif: '5417009999' }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
    expect(kit.refreshTokens.items).toHaveLength(1);
  });
});

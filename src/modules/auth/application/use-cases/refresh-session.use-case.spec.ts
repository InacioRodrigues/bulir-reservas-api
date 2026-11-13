import { RefreshSessionUseCase } from './refresh-session.use-case';
import { InvalidRefreshTokenError } from '../../domain/errors/auth.errors';
import { createAuthTestKit } from '@test/fakes/auth-test-kit';

describe('RefreshSessionUseCase', () => {
  const setup = async () => {
    const kit = createAuthTestKit();
    const user = await kit.seedUser();
    const session = await kit.sessions.issue(user);
    const useCase = new RefreshSessionUseCase(
      kit.tokens,
      kit.refreshTokens,
      kit.users,
      kit.sessions,
    );
    return { kit, user, session, useCase };
  };

  it('roda o token: devolve um par novo e revoga o antigo', async () => {
    const { kit, session, useCase } = await setup();

    const next = await useCase.execute(session.refreshToken);

    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect(next.accessToken).toBeTruthy();
    const old = await kit.refreshTokens.findByToken(session.refreshToken);
    expect(old?.isRevoked).toBe(true);
  });

  it('reutilizar um token já rodado → 401 e revoga TODAS as sessões', async () => {
    const { kit, session, useCase } = await setup();
    const next = await useCase.execute(session.refreshToken);

    await expect(useCase.execute(session.refreshToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    // O token "legítimo" mais recente também deixou de funcionar.
    await expect(useCase.execute(next.refreshToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(kit.refreshTokens.items.every((t) => t.isRevoked)).toBe(true);
  });

  it('dois refresh simultâneos com o mesmo token → só um ganha', async () => {
    const { session, useCase } = await setup();

    const results = await Promise.allSettled([
      useCase.execute(session.refreshToken),
      useCase.execute(session.refreshToken),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('assinatura inválida/expirada → 401 sem tocar na BD', async () => {
    const { kit, session, useCase } = await setup();
    kit.tokens.invalid.add(session.refreshToken);
    const find = jest.spyOn(kit.refreshTokens, 'findByToken');

    await expect(useCase.execute(session.refreshToken)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(find).not.toHaveBeenCalled();
  });

  it('token desconhecido (ex.: após logout) → 401', async () => {
    const { user, useCase } = await setup();

    await expect(
      useCase.execute(`refresh:${user.id}:999`),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });
});

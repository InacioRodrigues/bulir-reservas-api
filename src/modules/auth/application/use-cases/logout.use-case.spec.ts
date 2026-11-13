import { LogoutUseCase } from './logout.use-case';
import { createAuthTestKit } from '@test/fakes/auth-test-kit';

describe('LogoutUseCase', () => {
  it('apaga a sessão do próprio utilizador', async () => {
    const kit = createAuthTestKit();
    const user = await kit.seedUser();
    const session = await kit.sessions.issue(user);

    await new LogoutUseCase(kit.refreshTokens).execute(
      user.id,
      session.refreshToken,
    );

    expect(kit.refreshTokens.items).toHaveLength(0);
  });

  it('não apaga a sessão de outro utilizador', async () => {
    const kit = createAuthTestKit();
    const ana = await kit.seedUser();
    const session = await kit.sessions.issue(ana);

    await new LogoutUseCase(kit.refreshTokens).execute(
      'outro-user-id',
      session.refreshToken,
    );

    expect(kit.refreshTokens.items).toHaveLength(1);
  });
});

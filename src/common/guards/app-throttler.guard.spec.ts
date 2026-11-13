import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

const SECRET = 'test-access-secret';

class TestableGuard extends AppThrottlerGuard {
  tracker(req: Record<string, any>) {
    return this.getTracker(req);
  }
}

function makeGuard() {
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService;
  return new TestableGuard([], {} as ThrottlerStorage, new Reflector(), config);
}

const sign = (secret: string, payload: object) =>
  new JwtService({ secret }).sign(payload);

describe('AppThrottlerGuard', () => {
  const guard = makeGuard();

  it('conta por utilizador quando o access token é válido', async () => {
    const req = {
      ip: '10.0.0.1',
      headers: { authorization: `Bearer ${sign(SECRET, { sub: 'user-1' })}` },
    };
    await expect(guard.tracker(req)).resolves.toBe('user:user-1');
  });

  it('conta por IP sem token', async () => {
    await expect(guard.tracker({ ip: '10.0.0.1', headers: {} })).resolves.toBe(
      'ip:10.0.0.1',
    );
  });

  it('conta por IP quando o token tem assinatura inválida (sub forjado)', async () => {
    const req = {
      ip: '10.0.0.1',
      headers: { authorization: `Bearer ${sign('outro', { sub: 'x' })}` },
    };
    await expect(guard.tracker(req)).resolves.toBe('ip:10.0.0.1');
  });
});

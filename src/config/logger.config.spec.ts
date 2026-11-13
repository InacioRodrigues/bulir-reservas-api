import pino from 'pino';
import { Writable } from 'node:stream';
import { REDACT_PATHS } from './logger.config';

function capture(entry: object): Record<string, any> {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream).info(
    entry,
  );
  return JSON.parse(lines[0]) as Record<string, any>;
}

describe('logger redaction', () => {
  it('apaga Authorization e cookies dos headers', () => {
    const log = capture({
      req: { headers: { authorization: 'Bearer abc', cookie: 'sid=1' } },
    });
    expect(log.req.headers.authorization).toBe('[REDACTED]');
    expect(log.req.headers.cookie).toBe('[REDACTED]');
  });

  it('apaga passwords e tokens em objetos registados', () => {
    const log = capture({
      password: 'segredo1',
      dto: { identifier: 'ana@x.ao', password: 'segredo1' },
      result: { session: { refreshToken: 'r', accessToken: 'a' } },
    });
    expect(log.password).toBe('[REDACTED]');
    expect(log.dto.password).toBe('[REDACTED]');
    expect(log.dto.identifier).toBe('ana@x.ao');
    expect(log.result.session.refreshToken).toBe('[REDACTED]');
    expect(log.result.session.accessToken).toBe('[REDACTED]');
  });

  it('nunca inclui o valor original na linha', () => {
    const raw = JSON.stringify(capture({ user: { passwordHash: '$argon2' } }));
    expect(raw).not.toContain('$argon2');
  });
});

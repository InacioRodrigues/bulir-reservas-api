import { Request, Response } from 'express';
import { assignRequestIds, sanitizeIncomingId } from './request-ids';

const UUID = /^[0-9a-f-]{36}$/;

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    res: {
      setHeader: (k: string, v: string) => (headers[k] = v),
    } as unknown as Response,
  };
}

describe('request ids', () => {
  it('aceita ids do cliente num formato seguro', () => {
    expect(sanitizeIncomingId('abc-123_x.y:z')).toBe('abc-123_x.y:z');
  });

  it('rejeita ids longos, vazios ou com caracteres estranhos', () => {
    expect(sanitizeIncomingId('a'.repeat(129))).toBeUndefined();
    expect(sanitizeIncomingId('')).toBeUndefined();
    expect(sanitizeIncomingId('<script>')).toBeUndefined();
    expect(sanitizeIncomingId(['a', 'b'])).toBeUndefined();
  });

  it('gera UUIDs quando o header é inválido e devolve-os nos headers', () => {
    const req = { headers: { 'x-request-id': 'bad id with spaces' } };
    const { res, headers } = fakeRes();

    const ids = assignRequestIds(req as unknown as Request, res);

    expect(ids.requestId).toMatch(UUID);
    expect(ids.correlationId).toMatch(UUID);
    expect(headers['x-request-id']).toBe(ids.requestId);
  });

  it('é idempotente: uma segunda chamada mantém os mesmos ids', () => {
    const req = { headers: {} } as unknown as Request;
    const first = assignRequestIds(req, fakeRes().res);
    const second = assignRequestIds(req, fakeRes().res);
    expect(second).toEqual(first);
  });
});

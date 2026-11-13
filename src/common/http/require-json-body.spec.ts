import { NextFunction, Request, Response } from 'express';
import { requireJsonBody } from './require-json-body';

function call(method: string, headers: Record<string, string>) {
  const req = {
    method,
    headers,
    is: (type: string) =>
      (headers['content-type'] ?? '').startsWith(type) ? type : false,
  } as unknown as Request;
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  requireJsonBody(req, {} as Response, next);
  return next.mock.calls[0][0] as { getStatus?: () => number } | undefined;
}

describe('requireJsonBody', () => {
  it('aceita corpos JSON', () => {
    expect(
      call('POST', {
        'content-type': 'application/json; charset=utf-8',
        'content-length': '10',
      }),
    ).toBeUndefined();
  });

  it('rejeita formulários e texto com 415', () => {
    for (const type of ['application/x-www-form-urlencoded', 'text/plain']) {
      const error = call('POST', {
        'content-type': type,
        'content-length': '10',
      });
      expect(error?.getStatus?.()).toBe(415);
    }
  });

  it('ignora pedidos sem corpo (GET, PATCH de cancelamento)', () => {
    expect(call('GET', {})).toBeUndefined();
    expect(call('PATCH', { 'content-length': '0' })).toBeUndefined();
  });
});

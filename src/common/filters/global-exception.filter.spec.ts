import { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function run(exception: unknown) {
  const sent: { status?: number; body?: any } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: unknown) {
      sent.body = body;
    },
  };
  const request = { url: '/api/v1/x', method: 'POST', headers: {} };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  new GlobalExceptionFilter().catch(exception, host);
  return sent;
}

/** Imita os erros `http-errors` lançados pelo parser do corpo do Express. */
function bodyParserError(status: number, type: string) {
  return Object.assign(new Error(type), { status, type, expose: true });
}

describe('GlobalExceptionFilter', () => {
  it('corpo acima do limite → 413 PAYLOAD_TOO_LARGE', () => {
    const { status, body } = run(bodyParserError(413, 'entity.too.large'));
    expect(status).toBe(413);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('JSON malformado → 400 BAD_REQUEST sem ecoar o erro do parser', () => {
    const { status, body } = run(bodyParserError(400, 'entity.parse.failed'));
    expect(status).toBe(400);
    expect(body.code).toBe('BAD_REQUEST');
    expect(body.message).toBe('O corpo do pedido não é JSON válido');
  });

  it('erro inesperado → 500 sem expor a mensagem interna', () => {
    const { status, body } = run(new Error('relation "users" does not exist'));
    expect(status).toBe(500);
    expect(body.message).not.toContain('users');
  });
});

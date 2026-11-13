import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Formato aceite para `x-request-id` / `x-correlation-id` vindos do cliente.
 * Estes valores são ecoados nos headers da resposta, no corpo de erro e nos
 * logs: aceitar texto arbitrário (até 16 KB por header) permitiria encher os
 * logs ou injetar conteúdo enganador. Fora do formato → geramos um UUID.
 */
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export type RequestWithIds = Request & {
  requestId?: string;
  correlationId?: string;
};

export function sanitizeIncomingId(value: unknown): string | undefined {
  return typeof value === 'string' && SAFE_ID.test(value) ? value : undefined;
}

/**
 * Atribui (uma única vez) os ids do pedido e devolve-os nos headers.
 * Corre como primeiro middleware, antes do parser do corpo, para que até os
 * erros de JSON inválido ou corpo demasiado grande tenham `correlationId`.
 */
export function assignRequestIds(
  req: RequestWithIds,
  res: Response,
): { requestId: string; correlationId: string } {
  req.requestId ??=
    sanitizeIncomingId(req.headers['x-request-id']) ?? randomUUID();
  req.correlationId ??=
    sanitizeIncomingId(req.headers['x-correlation-id']) ?? randomUUID();

  res.setHeader('x-request-id', req.requestId);
  res.setHeader('x-correlation-id', req.correlationId);

  return { requestId: req.requestId, correlationId: req.correlationId };
}

import { NextFunction, Request, Response } from 'express';
import { UnsupportedMediaTypeException } from '../exceptions/http.exceptions';

/** Métodos cujo corpo tem significado para a API. */
const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * A API só fala JSON. Um corpo noutro formato (formulário HTML, texto,
 * multipart) nunca é processado: responde `415` em vez de deixar o pedido
 * chegar ao controller com um corpo vazio.
 *
 * Também fecha a porta aos únicos pedidos cross-site que um browser envia sem
 * *preflight* CORS (formulários `text/plain`/`x-www-form-urlencoded`).
 */
export function requireJsonBody(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const hasBody =
    Number(req.headers['content-length'] ?? 0) > 0 ||
    req.headers['transfer-encoding'] !== undefined;

  if (
    METHODS_WITH_BODY.has(req.method) &&
    hasBody &&
    !req.is('application/json')
  ) {
    next(new UnsupportedMediaTypeException());
    return;
  }

  next();
}

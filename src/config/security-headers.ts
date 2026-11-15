import { randomBytes } from 'node:crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';

/** Caminho da página de documentação interativa (Scalar). */
export const DOCS_PATH = '/reference';

/** Caminho do documento OpenAPI em JSON. */
export const OPENAPI_JSON_PATH = '/openapi.json';

/**
 * Bundle do Scalar servido pelo jsDelivr com versão fixa: um URL sem versão
 * passaria a executar qualquer versão nova publicada no CDN.
 */
export const SCALAR_CDN =
  'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.4';

/**
 * Política para a API (só JSON). Uma resposta JSON nunca precisa de carregar
 * scripts, estilos ou frames, por isso a CSP é "nada é permitido": se algum
 * dia um valor refletido fosse interpretado como HTML, o browser não executa
 * nada. `frame-ancestors 'none'` + `X-Frame-Options: DENY` impedem clickjacking.
 */
const apiHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
});

/**
 * Política para a página de documentação. Os scripts só correm se vierem do
 * CDN fixado ou tiverem o *nonce* gerado neste pedido (o script inline de
 * arranque do Scalar) — nada de `'unsafe-inline'` em `script-src`.
 * `style-src 'unsafe-inline'` é necessário porque o Scalar injeta estilos em
 * runtime; estilos não executam código. `connect-src 'self'` deixa o "Try it"
 * chamar esta mesma API e nada mais.
 */
const docsHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        SCALAR_CDN,
        (_req, res) => `'nonce-${(res as Response).locals.cspNonce}'`,
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", 'data:', 'https://fonts.scalar.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
});

function isDocsPath(path: string): boolean {
  return path === DOCS_PATH || path.startsWith(`${DOCS_PATH}/`);
}

/** Headers de segurança (Helmet) com uma CSP por tipo de resposta. */
export function securityHeaders(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isDocsPath(req.path)) {
      apiHeaders(req, res, next);
      return;
    }
    res.locals.cspNonce = randomBytes(16).toString('base64');
    docsHeaders(req, res, next);
  };
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { RequestContext } from '../helpers/request-context';
import { assignRequestIds, RequestWithIds } from '../http/request-ids';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithIds, res: Response, next: NextFunction) {
    // Os ids normalmente já foram atribuídos em `main.ts` (antes do parser do
    // corpo); aqui só os reutilizamos e abrimos o contexto assíncrono.
    const { requestId, correlationId } = assignRequestIds(req, res);

    RequestContext.run({ requestId, correlationId }, () => next());
  }
}

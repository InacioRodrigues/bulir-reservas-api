import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContext } from '../helpers/request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const correlationId =
      (req.headers['x-correlation-id'] as string) || uuidv4();

    // Attach to request object so Pino can pick it up
    (req as any).requestId = requestId;
    (req as any).correlationId = correlationId;

    // Set response headers
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);

    RequestContext.run(
      {
        requestId,
        correlationId,
      },
      () => {
        next();
      },
    );
  }
}

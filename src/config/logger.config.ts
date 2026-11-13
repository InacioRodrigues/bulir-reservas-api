import { Params } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';

export const loggerConfig: Params = {
  pinoHttp: {
    genReqId: (req: any) => {
      // Prioritize the request ID set by our middleware
      return req.requestId || req.headers['x-request-id'] || uuidv4();
    },
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              levelFirst: true,
              translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
            },
          }
        : undefined,
    customProps: (req: any) => {
      return {
        requestId: req.requestId || req.id,
        correlationId: req.correlationId || req.headers['x-correlation-id'],
      };
    },
    serializers: {
      req: (req: any) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
      }),
      err: (err: any) => ({
        type: err.type,
        message: err.message,
        stack: err.stack,
      }),
    },
    autoLogging: {
      ignore: (req) => req.url?.includes('/health') || false,
    },
    quietReqLogger: true,
  },
};

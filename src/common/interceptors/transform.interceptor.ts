import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      map((rawResult) => {
        // If response is already sent, or it's not JSON, do nothing
        if (response.headersSent) {
          return rawResult;
        }

        // If it already matches the structured format, pass it through
        if (
          rawResult &&
          typeof rawResult === 'object' &&
          'success' in rawResult
        ) {
          return rawResult;
        }

        let message = 'Operation successful';
        let data = rawResult;
        let meta = undefined;

        // If rawResult is an object with { data, message, meta } format, unwrap it
        if (
          rawResult &&
          typeof rawResult === 'object' &&
          ('data' in rawResult || 'meta' in rawResult || 'message' in rawResult)
        ) {
          message = rawResult.message || message;
          data = rawResult.data !== undefined ? rawResult.data : rawResult;
          meta = rawResult.meta || meta;

          // Clean up data if it contains message or meta at root
          if (data === rawResult) {
            const { message: _m, meta: _mt, data: _d, ...rest } = rawResult;
            data = _d !== undefined ? _d : rest;
          }
        }

        return {
          success: true,
          message,
          data: data === null || data === undefined ? {} : data,
          ...(meta ? { meta } : {}),
        };
      }),
    );
  }
}

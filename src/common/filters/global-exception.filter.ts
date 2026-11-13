import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseException } from '../exceptions/base.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let errors: any[] = [];

    // Retrieve correlation ID from request object if present
    const correlationId =
      request.headers['x-correlation-id'] || (request as any).correlationId;

    if (exception instanceof BaseException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse() as any;
      message = responseBody.message || exception.message;
      code = responseBody.code || exception.code;
      errors = responseBody.errors || exception.errors;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse() as any;

      if (typeof responseBody === 'object') {
        message = responseBody.message || exception.message;
        code = responseBody.error || 'HTTP_ERROR';
        // Handle validation array if it comes from built-in validators
        if (Array.isArray(responseBody.message)) {
          errors = responseBody.message;
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
        }
      } else {
        message = responseBody || exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // In production, mask raw database/system errors
      if (process.env.NODE_ENV === 'production') {
        message = 'An unexpected error occurred';
      }
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        {
          correlationId,
          path: request.url,
        },
      );
    }

    const errorResponse = {
      success: false,
      message,
      code,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log the error response
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status} - Error: ${message}`,
        undefined,
        { correlationId, errors },
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status: ${status} - Warning: ${message}`,
        { correlationId, errors },
      );
    }

    response.status(status).json(errorResponse);
  }
}

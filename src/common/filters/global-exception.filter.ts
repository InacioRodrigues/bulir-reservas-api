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

/**
 * `code` usado quando a exceção não traz um próprio (ex.: exceções lançadas
 * pelo Nest ou por bibliotecas, como o 429 do throttler ou um 404 de rota).
 * Assim o corpo de erro segue sempre o formato do contrato da API.
 */
const DEFAULT_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Pedido inválido',
  [HttpStatus.UNAUTHORIZED]: 'Não autenticado',
  [HttpStatus.FORBIDDEN]: 'Sem permissão para realizar esta operação',
  [HttpStatus.NOT_FOUND]: 'Recurso não encontrado',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Corpo do pedido demasiado grande',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Tipo de conteúdo não suportado',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Demasiados pedidos. Tente novamente dentro de instantes',
};

/**
 * Erros do parser do corpo (Express/`body-parser`) não são `HttpException`:
 * são objetos `http-errors` com `status` e `expose: true` (ex.: JSON
 * malformado → 400, corpo acima do limite → 413). Sem este tratamento
 * chegariam ao cliente como 500.
 */
function clientHttpErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { status, expose } = exception as {
    status?: unknown;
    expose?: unknown;
  };
  return expose === true &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
    ? status
    : undefined;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ocorreu um erro inesperado';
    let code = 'INTERNAL_SERVER_ERROR';
    let errors: unknown[] = [];

    const correlationId =
      (request as any).correlationId ?? request.headers['x-correlation-id'];

    const clientStatus = clientHttpErrorStatus(exception);

    if (exception instanceof BaseException) {
      status = exception.getStatus();
      message = exception.message;
      code = exception.code;
      errors = exception.errors;
    } else if (exception instanceof HttpException) {
      // Exceções do Nest/bibliotecas não têm `code`: derivamos do status.
      status = exception.getStatus();
      code = DEFAULT_CODES[status] ?? 'HTTP_ERROR';
      message = DEFAULT_MESSAGES[status] ?? exception.message;
    } else if (clientStatus !== undefined) {
      status = clientStatus;
      code = DEFAULT_CODES[status] ?? 'BAD_REQUEST';
      message =
        (exception as { type?: string }).type === 'entity.parse.failed'
          ? 'O corpo do pedido não é JSON válido'
          : (DEFAULT_MESSAGES[status] ?? DEFAULT_MESSAGES[400]);
    } else if (exception instanceof Error) {
      // Erro não previsto (ex.: falha da BD). A mensagem original nunca vai
      // para o cliente: pode expor SQL, nomes de tabelas ou dados.
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        { correlationId, path: request.url },
      );
    }

    if (status < 500) {
      this.logger.warn(
        `[${request.method}] ${request.url} - ${status} ${code}`,
        { correlationId },
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      code,
      message,
      errors,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId,
    });
  }
}

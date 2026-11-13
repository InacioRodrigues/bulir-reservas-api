import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

export class BusinessException extends BaseException {
  constructor(message: string, code = 'BUSINESS_ERROR', errors: any[] = []) {
    super(message, HttpStatus.BAD_REQUEST, code, errors);
  }
}

/** 400 com a lista de campos inválidos: `errors: [{ field, message }]`. */
export class ValidationException extends BaseException {
  constructor(errors: any[] = [], message = 'Dados inválidos') {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', errors);
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message = 'Não autenticado', code = 'UNAUTHORIZED') {
    super(message, HttpStatus.UNAUTHORIZED, code);
  }
}

export class ForbiddenException extends BaseException {
  constructor(
    message = 'Sem permissão para realizar esta operação',
    code = 'FORBIDDEN',
  ) {
    super(message, HttpStatus.FORBIDDEN, code);
  }
}

export class ConflictException extends BaseException {
  constructor(message: string, code = 'CONFLICT') {
    super(message, HttpStatus.CONFLICT, code);
  }
}

export class NotFoundException extends BaseException {
  constructor(message: string, code = 'NOT_FOUND') {
    super(message, HttpStatus.NOT_FOUND, code);
  }
}

export class UnsupportedMediaTypeException extends BaseException {
  constructor(
    message = 'O corpo do pedido tem de ser JSON (Content-Type: application/json)',
  ) {
    super(message, HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_MEDIA_TYPE');
  }
}

export class InternalServerException extends BaseException {
  constructor(
    message = 'Ocorreu um erro inesperado',
    code = 'INTERNAL_SERVER_ERROR',
    errors: any[] = [],
  ) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, code, errors);
  }
}

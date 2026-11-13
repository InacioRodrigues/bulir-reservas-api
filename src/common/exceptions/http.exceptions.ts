import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

export class BusinessException extends BaseException {
  constructor(message: string, code = 'BUSINESS_ERROR', errors: any[] = []) {
    super(message, HttpStatus.BAD_REQUEST, code, errors);
  }
}

export class ValidationException extends BaseException {
  constructor(errors: any[] = [], message = 'Validation failed') {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', errors);
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message = 'Unauthorized access', code = 'UNAUTHORIZED') {
    super(message, HttpStatus.UNAUTHORIZED, code);
  }
}

export class ForbiddenException extends BaseException {
  constructor(message = 'Access forbidden', code = 'FORBIDDEN') {
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

export class InternalServerException extends BaseException {
  constructor(
    message = 'Internal server error',
    code = 'INTERNAL_SERVER_ERROR',
    errors: any[] = [],
  ) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, code, errors);
  }
}

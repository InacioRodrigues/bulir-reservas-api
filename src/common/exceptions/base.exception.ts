import { HttpException } from '@nestjs/common';

export abstract class BaseException extends HttpException {
  constructor(
    message: string,
    statusCode: number,
    public readonly code: string,
    public readonly errors: any[] = [],
  ) {
    super(
      {
        success: false,
        message,
        code,
        errors,
      },
      statusCode,
    );
  }
}

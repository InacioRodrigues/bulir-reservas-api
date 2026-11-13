import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ValidationException } from '../exceptions/http.exceptions';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (
      metadata.type !== 'body' &&
      metadata.type !== 'query' &&
      metadata.type !== 'param'
    ) {
      return value;
    }

    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors: Array<{ field: string; message: string }> =
        result.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
      throw new ValidationException(errors, 'Validation failed');
    }

    return result.data;
  }
}

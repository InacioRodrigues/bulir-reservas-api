import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { ValidationException } from '../exceptions/http.exceptions';

const uuidSchema = z.uuid();

/**
 * Valida parâmetros de rota que são UUID (ex.: `@Param('id', UuidParamPipe)`).
 *
 * Os IDs são `uuid` nativos no Postgres: sem esta validação, `/services/abc`
 * chegaria à BD e falharia com um erro de tipo (500). Assim responde-se
 * `400 VALIDATION_ERROR` sem tocar na BD.
 */
@Injectable()
export class UuidParamPipe implements PipeTransform<unknown, string> {
  transform(value: unknown, metadata: ArgumentMetadata): string {
    const result = uuidSchema.safeParse(value);
    if (!result.success) {
      const field = metadata.data ?? 'id';
      throw new ValidationException([
        { field, message: `${field} deve ser um UUID válido` },
      ]);
    }
    return result.data;
  }
}

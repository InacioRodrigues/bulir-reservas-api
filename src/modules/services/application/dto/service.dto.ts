import { z } from 'zod';
import { Money } from '@common/domain/money';
import { paginationQuerySchema } from '@common/pagination/pagination';
import {
  isPriceInRange,
  SERVICE_RULES,
} from '../../domain/entities/service-rules';
import { SERVICE_SORTS } from '../../domain/repositories/service.repository.interface';

const MONEY_FORMAT_MESSAGE =
  'deve ser uma string decimal com até 2 casas, ex.: "1500.00"';

/**
 * Preço como **string** decimal. Um `number` em JSON já foi convertido para
 * float pelo `JSON.parse` antes de chegar aqui, por isso é rejeitado: o
 * contrato diz que dinheiro viaja como string e assim não há ambiguidade.
 * Sai normalizado com 2 casas ("1500" → "1500.00").
 */
const priceSchema = z
  .string({ error: `O preço ${MONEY_FORMAT_MESSAGE}` })
  .trim()
  .refine(Money.isValid, { error: `O preço ${MONEY_FORMAT_MESSAGE}` })
  .transform((value) => Money.parse(value, 'price'))
  .refine(isPriceInRange, {
    error: `O preço deve ser maior que 0 e no máximo ${SERVICE_RULES.price.max.toString()}`,
  })
  .transform((price) => price.toString());

const nameSchema = z
  .string({ error: 'O nome é obrigatório' })
  .trim()
  .min(
    SERVICE_RULES.name.min,
    `O nome deve ter pelo menos ${SERVICE_RULES.name.min} caracteres`,
  )
  .max(
    SERVICE_RULES.name.max,
    `O nome deve ter no máximo ${SERVICE_RULES.name.max} caracteres`,
  );

const descriptionSchema = z
  .string({ error: 'A descrição é obrigatória' })
  .trim()
  .min(
    SERVICE_RULES.description.min,
    `A descrição deve ter pelo menos ${SERVICE_RULES.description.min} caracteres`,
  )
  .max(
    SERVICE_RULES.description.max,
    `A descrição deve ter no máximo ${SERVICE_RULES.description.max} caracteres`,
  );

/**
 * Campos desconhecidos (ex.: `providerId`, `deletedAt`) são descartados pelo
 * zod: o prestador associado é sempre o utilizador autenticado, nunca um
 * valor vindo do corpo (proteção contra mass assignment).
 */
export const createServiceSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  price: priceSchema,
});

export const updateServiceSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    price: priceSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.price !== undefined,
    {
      error:
        'Indique pelo menos um campo a alterar: name, description ou price',
    },
  );

/** Filtro de preço da query string: ≥ 0, até 2 casas, normalizado. */
const priceFilterSchema = z
  .string()
  .trim()
  .refine(Money.isValid, { error: `O valor ${MONEY_FORMAT_MESSAGE}` })
  .transform((value) => Money.parse(value).toString())
  .optional();

export const listServicesQuerySchema = paginationQuerySchema
  .extend({
    search: z
      .string({ error: 'search deve ser um texto' })
      .trim()
      .max(100, 'search deve ter no máximo 100 caracteres')
      .optional()
      .transform((value) => value || undefined),
    minPrice: priceFilterSchema,
    maxPrice: priceFilterSchema,
    sort: z
      .enum(SERVICE_SORTS, {
        error: `sort deve ser um de: ${SERVICE_SORTS.join(', ')}`,
      })
      .default('newest'),
  })
  .superRefine((query, ctx) => {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      Money.parse(query.minPrice).greaterThan(Money.parse(query.maxPrice))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxPrice'],
        message: 'maxPrice deve ser maior ou igual a minPrice',
      });
    }
  });

export const myServicesQuerySchema = paginationQuerySchema;

export type CreateServiceDto = z.infer<typeof createServiceSchema>;
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;
export type ListServicesQueryDto = z.infer<typeof listServicesQuerySchema>;
export type MyServicesQueryDto = z.infer<typeof myServicesQuerySchema>;

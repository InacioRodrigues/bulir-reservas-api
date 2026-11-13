/** Blocos reutilizados pelas rotas da especificação OpenAPI. */

export const errorContent = (example: Record<string, unknown>) => ({
  'application/json': {
    schema: { $ref: '#/components/schemas/Error' },
    example: { success: false, ...example },
  },
});

export const errorResponse = (
  description: string,
  example: { statusCode: number; code: string; message: string },
) => ({ description, content: errorContent(example) });

export const pageParams = [
  {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 10000, default: 1 },
  },
  {
    name: 'perPage',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
];

export const uuidPathParam = (description: string) => ({
  name: 'id',
  in: 'path',
  required: true,
  description: `${description} (outro formato → 400 \`VALIDATION_ERROR\`)`,
  schema: { type: 'string', format: 'uuid' },
});

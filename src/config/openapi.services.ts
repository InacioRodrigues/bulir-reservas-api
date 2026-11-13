/** Rotas `/services` da especificação OpenAPI (ver `openapi.definition.ts`). */
import { errorContent, pageParams, uuidPathParam } from './openapi.common';

const idParam = uuidPathParam('UUID do serviço');

const serviceExample = {
  id: '6ae57059-13c9-4f3e-97bd-63ab09e7d40a',
  name: 'Corte de cabelo',
  description: 'Corte e penteado ao domicílio.',
  price: '5000.00',
  provider: {
    id: '830cfc3f-befa-4577-bfe6-b22862444c9a',
    fullName: 'Carla Sofia Neto',
  },
  createdAt: '2026-11-13T22:23:25.835Z',
  updatedAt: '2026-11-13T22:23:25.835Z',
};

const serviceResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { $ref: '#/components/schemas/Service' },
        },
      },
      example: { success: true, message: description, data: serviceExample },
    },
  },
});

const servicePageResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Service' },
          },
          meta: { $ref: '#/components/schemas/PageMeta' },
        },
      },
      example: {
        success: true,
        message: description,
        data: [serviceExample],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      },
    },
  },
});

const forbidden = (message: string) => ({
  description: '`FORBIDDEN`',
  content: errorContent({ statusCode: 403, code: 'FORBIDDEN', message }),
});

const notFound = {
  description: '`NOT_FOUND`: não existe ou foi eliminado',
  content: errorContent({
    statusCode: 404,
    code: 'NOT_FOUND',
    message: 'Serviço não encontrado',
  }),
};

const priceField = {
  type: 'string',
  pattern: '^\\d{1,13}(\\.\\d{1,2})?$',
  description:
    'String decimal, > 0 e ≤ 10000000.00, até 2 casas. Um número JSON é rejeitado. Devolvido sempre com 2 casas.',
  example: '5000.00',
};

const serviceBody = (required: string[]) => ({
  type: 'object',
  required,
  properties: {
    name: { type: 'string', minLength: 3, maxLength: 100 },
    description: { type: 'string', minLength: 10, maxLength: 1000 },
    price: priceField,
  },
});

const notOwner =
  'Só o prestador que publicou o serviço o pode alterar ou eliminar';

export const servicesPaths = {
  '/api/v1/services': {
    get: {
      summary: 'Catálogo de serviços ativos',
      description:
        'Serviços não eliminados de todos os prestadores. Pesquisa sem distinguir maiúsculas no nome e na descrição (`%` e `_` são texto literal); filtros de preço inclusivos.',
      tags: ['Services'],
      parameters: [
        ...pageParams,
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string', maxLength: 100 },
        },
        {
          name: 'minPrice',
          in: 'query',
          schema: { type: 'string', example: '1000.00' },
        },
        {
          name: 'maxPrice',
          in: 'query',
          description: 'Tem de ser ≥ `minPrice`',
          schema: { type: 'string', example: '20000.00' },
        },
        {
          name: 'sort',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['newest', 'oldest', 'price_asc', 'price_desc', 'name_asc'],
            default: 'newest',
          },
        },
      ],
      responses: {
        '200': servicePageResponse('Serviços obtidos com sucesso'),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      summary: 'Publicar um serviço (PROVIDER)',
      description:
        'O prestador associado é sempre o utilizador autenticado; campos desconhecidos (ex.: `providerId`) são ignorados.',
      tags: ['Services'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: serviceBody(['name', 'description', 'price']),
            example: {
              name: 'Pintura de interiores',
              description: 'Pintura de sala e quartos, material incluído.',
              price: '20000.00',
            },
          },
        },
      },
      responses: {
        '201': serviceResponse('Serviço criado com sucesso'),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': forbidden('O seu perfil não tem permissão para esta operação'),
      },
    },
  },
  '/api/v1/services/mine': {
    get: {
      summary: 'Os meus serviços (PROVIDER)',
      description:
        'Serviços ativos do prestador autenticado, mais recentes primeiro.',
      tags: ['Services'],
      parameters: pageParams,
      responses: {
        '200': servicePageResponse('Os seus serviços obtidos com sucesso'),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': forbidden('O seu perfil não tem permissão para esta operação'),
      },
    },
  },
  '/api/v1/services/{id}': {
    parameters: [idParam],
    get: {
      summary: 'Detalhe de um serviço ativo',
      tags: ['Services'],
      responses: {
        '200': serviceResponse('Serviço obtido com sucesso'),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': notFound,
      },
    },
    patch: {
      summary: 'Alterar um serviço (PROVIDER dono)',
      description:
        'Alteração parcial (pelo menos um campo). As reservas já feitas mantêm o nome e o preço do momento da reserva.',
      tags: ['Services'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: serviceBody([]),
            example: { price: '18000.00' },
          },
        },
      },
      responses: {
        '200': serviceResponse('Serviço atualizado com sucesso'),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': forbidden(notOwner),
        '404': notFound,
      },
    },
    delete: {
      summary: 'Eliminar um serviço (PROVIDER dono, soft delete)',
      description:
        'O serviço sai do catálogo e deixa de poder ser reservado; o histórico de reservas mantém-se.',
      tags: ['Services'],
      responses: {
        '204': { description: 'Serviço eliminado' },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': forbidden(notOwner),
        '404': notFound,
      },
    },
  },
};

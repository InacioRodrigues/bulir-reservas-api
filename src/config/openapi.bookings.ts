/** Rotas `/bookings` da especificação OpenAPI (ver `openapi.definition.ts`). */
import { errorResponse, pageParams, uuidPathParam } from './openapi.common';

const idParam = uuidPathParam('UUID da reserva');

export const bookingExample = {
  id: 'b3c1f0e2-6a43-4d7e-9a0b-2f1f6a9d8c11',
  status: 'CONFIRMED',
  price: '5000.00',
  service: {
    id: '6ae57059-13c9-4f3e-97bd-63ab09e7d40a',
    name: 'Corte de cabelo',
  },
  client: {
    id: '1f0e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b',
    fullName: 'Ana Paula Domingos',
  },
  provider: {
    id: '830cfc3f-befa-4577-bfe6-b22862444c9a',
    fullName: 'Carla Sofia Neto',
  },
  createdAt: '2026-11-14T10:00:00.000Z',
  cancelledAt: null,
  cancelledBy: null,
};

export const bookingResponse = (
  description: string,
  example: Record<string, unknown> = bookingExample,
) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { $ref: '#/components/schemas/Booking' },
        },
      },
      example: { success: true, message: description, data: example },
    },
  },
});

export const notParticipant = errorResponse(
  '`FORBIDDEN`: não é o cliente nem o prestador da reserva',
  {
    statusCode: 403,
    code: 'FORBIDDEN',
    message: 'Só o cliente ou o prestador da reserva têm acesso a ela',
  },
);

export const bookingNotFound = errorResponse('`NOT_FOUND`', {
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'Reserva não encontrada',
});

export const bookingsPaths = {
  '/api/v1/bookings': {
    get: {
      summary: 'Histórico de reservas em que participo',
      description:
        'Cliente: as reservas que fez. Prestador: as reservas dos seus serviços. Inclui canceladas e de serviços já eliminados (nome e preço do momento da reserva). Mais recentes primeiro.',
      tags: ['Bookings'],
      parameters: [
        ...pageParams,
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['CONFIRMED', 'CANCELLED'] },
        },
      ],
      responses: {
        '200': {
          description: 'Reservas obtidas com sucesso',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Booking' },
                  },
                  meta: { $ref: '#/components/schemas/PageMeta' },
                },
              },
              example: {
                success: true,
                message: 'Reservas obtidas com sucesso',
                data: [bookingExample],
                meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      summary: 'Reservar um serviço (CLIENT)',
      description:
        'Numa única transação: débito condicional do cliente (`WHERE balance >= preço`), crédito do prestador, reserva com snapshot do nome/preço e dois movimentos no ledger. Saldo igual ao preço é suficiente. Limite: 10 pedidos/min por utilizador.',
      tags: ['Bookings'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['serviceId'],
              properties: { serviceId: { type: 'string', format: 'uuid' } },
            },
            example: { serviceId: '6ae57059-13c9-4f3e-97bd-63ab09e7d40a' },
          },
        },
      },
      responses: {
        '201': bookingResponse('Reserva criada com sucesso'),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': { $ref: '#/components/responses/TooManyRequests' },
        '403': errorResponse('`FORBIDDEN`: só clientes reservam', {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'O seu perfil não tem permissão para esta operação',
        }),
        '404': errorResponse('`NOT_FOUND`: serviço inexistente ou eliminado', {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Serviço não encontrado',
        }),
        '409': errorResponse('`INSUFFICIENT_BALANCE`', {
          statusCode: 409,
          code: 'INSUFFICIENT_BALANCE',
          message: 'Saldo insuficiente para reservar este serviço',
        }),
      },
    },
  },
  '/api/v1/bookings/{id}': {
    parameters: [idParam],
    get: {
      summary: 'Detalhe de uma reserva (participante)',
      tags: ['Bookings'],
      responses: {
        '200': bookingResponse('Reserva obtida com sucesso'),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': notParticipant,
        '404': bookingNotFound,
      },
    },
  },
  '/api/v1/bookings/{id}/cancel': {
    parameters: [idParam],
    patch: {
      summary: 'Cancelar uma reserva (cliente da reserva ou prestador)',
      description:
        'Numa única transação: `UPDATE ... WHERE status = CONFIRMED` (só um pedido vence), reembolso integral do preço pago ao cliente, débito ao prestador e dois movimentos no ledger. Limite: 10 pedidos/min por utilizador.',
      tags: ['Bookings'],
      responses: {
        '200': bookingResponse('Reserva cancelada e valor reembolsado', {
          ...bookingExample,
          status: 'CANCELLED',
          cancelledAt: '2026-11-14T11:00:00.000Z',
          cancelledBy: 'CLIENT',
        }),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': { $ref: '#/components/responses/TooManyRequests' },
        '403': notParticipant,
        '404': bookingNotFound,
        '409': errorResponse(
          '`BOOKING_ALREADY_CANCELLED` ou `PROVIDER_INSUFFICIENT_BALANCE`',
          {
            statusCode: 409,
            code: 'BOOKING_ALREADY_CANCELLED',
            message: 'Esta reserva já foi cancelada',
          },
        ),
      },
    },
  },
};

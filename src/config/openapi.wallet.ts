/** Rotas `/wallet` da especificação OpenAPI (ver `openapi.definition.ts`). */
import { errorResponse, pageParams } from './openapi.common';

export const walletPaths = {
  '/api/v1/wallet/top-up': {
    post: {
      summary: 'Carregar saldo (CLIENT, simulado)',
      description:
        'Crédito imediato (não há gateway de pagamento). Saldo e movimento `TOP_UP` no ledger gravados na mesma transação. Limite: 10 pedidos/min por utilizador.',
      tags: ['Wallet'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount'],
              properties: {
                amount: {
                  type: 'string',
                  pattern: '^\\d{1,13}(\\.\\d{1,2})?$',
                  description:
                    'String decimal, > 0 e ≤ 1000000.00, até 2 casas. Um número JSON é rejeitado.',
                  example: '20000.00',
                },
              },
            },
            example: { amount: '20000.00' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Saldo carregado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      balance: { type: 'string', example: '70000.00' },
                    },
                  },
                },
              },
              example: {
                success: true,
                message: 'Saldo carregado com sucesso',
                data: { balance: '70000.00' },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': { $ref: '#/components/responses/TooManyRequests' },
        '403': errorResponse('`FORBIDDEN`: só clientes carregam saldo', {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'O seu perfil não tem permissão para esta operação',
        }),
      },
    },
  },
  '/api/v1/wallet/transactions': {
    get: {
      summary: 'Extrato da minha carteira',
      description:
        'Movimentos do utilizador autenticado (cliente ou prestador), mais recentes primeiro. `amount` com sinal: créditos positivos, débitos negativos; `balanceAfter` é o saldo logo a seguir ao movimento.',
      tags: ['Wallet'],
      parameters: pageParams,
      responses: {
        '200': {
          description: 'Movimentos obtidos com sucesso',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/WalletTransaction' },
                  },
                  meta: { $ref: '#/components/schemas/PageMeta' },
                },
              },
              example: {
                success: true,
                message: 'Movimentos obtidos com sucesso',
                data: [
                  {
                    id: '0d6c5f1e-8a3b-4c2d-9e1f-7a6b5c4d3e2f',
                    type: 'BOOKING_DEBIT',
                    amount: '-5000.00',
                    balanceAfter: '45000.00',
                    bookingId: 'b3c1f0e2-6a43-4d7e-9a0b-2f1f6a9d8c11',
                    createdAt: '2026-11-14T10:00:00.000Z',
                  },
                  {
                    id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
                    type: 'TOP_UP',
                    amount: '50000.00',
                    balanceAfter: '50000.00',
                    bookingId: null,
                    createdAt: '2026-11-14T09:00:00.000Z',
                  },
                ],
                meta: { page: 1, perPage: 20, total: 2, totalPages: 1 },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
};

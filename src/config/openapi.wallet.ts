/** Rotas `/wallet` da especificação OpenAPI (ver `openapi.definition.ts`). */
import { errorResponse } from './openapi.common';

export const walletPaths = {
  '/api/v1/wallet/top-up': {
    post: {
      summary: 'Carregar saldo (CLIENT, simulado)',
      description:
        'Crédito imediato (não há gateway de pagamento). Saldo e movimento `TOP_UP` no ledger gravados na mesma transação.',
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
        '403': errorResponse('`FORBIDDEN`: só clientes carregam saldo', {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'O seu perfil não tem permissão para esta operação',
        }),
      },
    },
  },
};

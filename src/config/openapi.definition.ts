import { servicesPaths } from './openapi.services';
import { walletPaths } from './openapi.wallet';
import { bookingsPaths } from './openapi.bookings';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Bulir Reservas API',
    description:
      'Documentação de referência da API de reservas Bulir (Scalar).',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor Local',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token devolvido por /auth/login ou /auth/register.',
      },
    },
    schemas: {
      UserResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fullName: { type: 'string' },
          nif: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['CLIENT', 'PROVIDER'] },
          balance: { type: 'string', example: '1500.00' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Service: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'string', example: '5000.00' },
          provider: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              fullName: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['CONFIRMED', 'CANCELLED'] },
          price: {
            type: 'string',
            example: '5000.00',
            description: 'Preço pago (congelado no momento da reserva)',
          },
          service: {
            type: 'object',
            description: 'Nome congelado no momento da reserva',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
            },
          },
          client: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              fullName: { type: 'string' },
            },
          },
          provider: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              fullName: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          cancelledAt: { type: 'string', format: 'date-time', nullable: true },
          cancelledBy: {
            type: 'string',
            enum: ['CLIENT', 'PROVIDER'],
            nullable: true,
          },
        },
      },
      WalletTransaction: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: {
            type: 'string',
            enum: [
              'TOP_UP',
              'BOOKING_DEBIT',
              'BOOKING_CREDIT',
              'REFUND_CREDIT',
              'REFUND_DEBIT',
            ],
          },
          amount: {
            type: 'string',
            example: '-5000.00',
            description: 'Com sinal: crédito positivo, débito negativo',
          },
          balanceAfter: { type: 'string', example: '45000.00' },
          bookingId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PageMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          perPage: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/UserResponse' },
              accessToken: { type: 'string', description: 'JWT, 15 min' },
              refreshToken: {
                type: 'string',
                description: 'JWT, 7 dias, uso único',
              },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 409 },
          code: { type: 'string', example: 'EMAIL_ALREADY_EXISTS' },
          message: { type: 'string' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
          path: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          correlationId: { type: 'string' },
        },
      },
    },
    responses: {
      ValidationError: {
        description: '`VALIDATION_ERROR` com `errors: [{ field, message }]`',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Unauthorized: {
        description: '`UNAUTHORIZED`: token em falta, inválido ou expirado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      TooManyRequests: {
        description: '`TOO_MANY_REQUESTS`',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/api/v1/health': {
      get: {
        summary: 'Verificar estado da aplicação',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Uptime e estado dos serviços internos',
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        summary: 'Criar conta (Cliente ou Prestador de Serviço)',
        description:
          'E-mail guardado em minúsculas e NIF em maiúsculas sem espaços; ambos únicos. Limite: 5 pedidos/min por IP.',
        tags: ['Auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'nif', 'email', 'password', 'role'],
                properties: {
                  fullName: { type: 'string', minLength: 3, maxLength: 120 },
                  nif: {
                    type: 'string',
                    description: '9 a 14 letras ou dígitos',
                    example: '004512345LA041',
                  },
                  email: { type: 'string', format: 'email' },
                  password: {
                    type: 'string',
                    minLength: 8,
                    maxLength: 128,
                    description: 'Pelo menos uma letra e um número',
                  },
                  role: { type: 'string', enum: ['CLIENT', 'PROVIDER'] },
                },
              },
              example: {
                fullName: 'Ana Paula Domingos',
                nif: '004512345LA041',
                email: 'ana@exemplo.ao',
                password: 'Senha123',
                role: 'CLIENT',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Conta criada e sessão iniciada',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '409': {
            description: '`EMAIL_ALREADY_EXISTS` ou `NIF_ALREADY_EXISTS`',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '429': { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Iniciar sessão com e-mail ou NIF',
        description:
          '`identifier` com "@" é tratado como e-mail; caso contrário como NIF. Limite: 5 pedidos/min por IP.',
        tags: ['Auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['identifier', 'password'],
                properties: {
                  identifier: { type: 'string', example: '004512345LA041' },
                  password: { type: 'string' },
                },
              },
              example: {
                identifier: 'ana.cliente@bulir.demo',
                password: 'Senha@123',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sessão iniciada',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': {
            description:
              '`INVALID_CREDENTIALS` (genérico: não revela se a conta existe)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '429': { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        summary: 'Renovar sessão (rotação do refresh token)',
        description:
          'Cada refresh token só pode ser usado uma vez. Reutilizar um token já rodado revoga todas as sessões do utilizador.',
        tags: ['Auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Novo par de tokens',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        summary: 'Terminar sessão (apaga o refresh token)',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '204': { description: 'Sessão terminada' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        summary: 'Perfil do utilizador autenticado (com saldo atual)',
        tags: ['Auth'],
        responses: {
          '200': {
            description: 'Perfil',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/UserResponse' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    ...servicesPaths,
    ...walletPaths,
    ...bookingsPaths,
  },
};

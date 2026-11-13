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
        description: 'Introduce your Bearer access token here.',
      },
    },
    schemas: {
      UserResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'USER', 'MANAGER'] },
          isActive: { type: 'boolean' },
          isEmailVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
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
        summary: 'Registar um novo utilizador',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Utilizador criado com sucesso',
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Iniciar sessão',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Autenticação bem sucedida, retorna tokens',
          },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        summary: 'Atualizar tokens expirados',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Novos Access Token e Refresh Token gerados',
          },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        summary: 'Terminar sessão',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Logout efetuado e token blacklisted',
          },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        summary: 'Obter dados do perfil autenticado',
        tags: ['Authentication'],
        responses: {
          '200': {
            description: 'Perfil do utilizador atual',
          },
        },
      },
    },
    '/api/v1/users': {
      post: {
        summary: 'Criar novo utilizador (Apenas Admin)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['ADMIN', 'USER', 'MANAGER'] },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Utilizador criado com sucesso',
          },
        },
      },
      get: {
        summary: 'Listar utilizadores paginados',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10 },
          },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', default: 'createdAt' },
          },
          {
            name: 'sortOrder',
            in: 'query',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Lista de utilizadores',
          },
        },
      },
    },
  },
};

// adapter: in — esquemas JSON de Fastify (entrada con additionalProperties:false; respuestas por status)

export const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

// Registro y login: la validación de forma de email y de longitud de contraseña es del dominio.
export const credentialsBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', maxLength: 1024 },
    password: { type: 'string', maxLength: 1024 },
  },
} as const;

export const userResponseSchema = {
  type: 'object',
  required: ['id', 'email'],
  properties: { id: { type: 'string' }, email: { type: 'string' } },
} as const;

// El refresh token viaja solo en la cookie: no figura en el cuerpo.
export const sessionResponseSchema = {
  type: 'object',
  required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
  properties: {
    accessToken: { type: 'string' },
    tokenType: { type: 'string' },
    expiresIn: { type: 'integer' },
    user: userResponseSchema,
  },
} as const;

// Solo la parte pública de la llave: `d` y cualquier otro campo no declarado nunca se serializan.
export const jwksResponseSchema = {
  type: 'object',
  required: ['keys'],
  properties: {
    keys: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kty', 'crv', 'x', 'kid', 'alg', 'use'],
        properties: {
          kty: { type: 'string' },
          crv: { type: 'string' },
          x: { type: 'string' },
          kid: { type: 'string' },
          alg: { type: 'string' },
          use: { type: 'string' },
        },
      },
    },
  },
} as const;

export const healthResponseSchema = {
  type: 'object',
  required: ['status'],
  properties: { status: { type: 'string' } },
} as const;

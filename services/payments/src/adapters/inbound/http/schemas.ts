export const errorSchema = {
  type: 'object',
  required: ['error'],
  additionalProperties: false,
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      additionalProperties: false,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
} as const;

const transferProperties = {
  id: { type: 'string' },
  type: { type: 'string', enum: ['INTERNAL', 'EXTERNAL'] },
  fromAccountId: { type: 'string' },
  toAccountId: { type: ['string', 'null'] },
  toExternalAccount: { type: 'string' },
  amount: { type: 'string' },
  currency: { type: 'string', const: 'COP' },
  status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'UNKNOWN', 'REVERSED'] },
  failureReason: { type: 'string', enum: ['INSUFFICIENT_FUNDS', 'RAIL_REJECTED', 'RAIL_UNAVAILABLE'] },
  createdAt: { type: 'string' },
  completedAt: { type: ['string', 'null'] },
} as const;

export const transferViewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'type', 'fromAccountId', 'toAccountId', 'amount', 'currency', 'status', 'createdAt', 'completedAt'],
  properties: transferProperties,
} as const;

export const reversalViewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'transferId', 'amount', 'status', 'createdAt', 'completedAt'],
  properties: {
    id: { type: 'string' },
    transferId: { type: 'string' },
    amount: { type: 'string' },
    status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'REJECTED', 'UNKNOWN'] },
    rejectionReason: { type: 'string', enum: ['RAIL_REJECTED', 'RAIL_UNAVAILABLE'] },
    createdAt: { type: 'string' },
    completedAt: { type: ['string', 'null'] },
  },
} as const;

export const transferDetailSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...transferViewSchema.required, 'reversal'],
  properties: {
    ...transferProperties,
    reversal: { anyOf: [reversalViewSchema, { type: 'null' }] },
  },
} as const;

export const createTransferBodySchema = {
  type: 'object',
  required: ['type', 'fromAccountId'],
  properties: {
    type: { type: 'string', enum: ['INTERNAL', 'EXTERNAL'] },
    fromAccountId: { type: 'string', minLength: 1, maxLength: 64 },
    toAccountId: { type: 'string', minLength: 1, maxLength: 64 },
    toExternalAccount: { type: 'string', pattern: '^[A-Z0-9-]{6,34}$' },
    amount: {},
  },
  additionalProperties: false,
  if: { type: 'object', required: ['type'], properties: { type: { const: 'EXTERNAL' } } },
  then: { type: 'object', required: ['toExternalAccount'], properties: { toAccountId: false } },
  else: { type: 'object', required: ['toAccountId'], properties: { toExternalAccount: false } },
} as const;

export const emptyBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
} as const;

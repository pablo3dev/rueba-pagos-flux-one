// adapter: in — esquemas JSON de Fastify (entrada con additionalProperties:false)
export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
} as const;

export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string' },
  },
} as const;

export const transferIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['transferId'],
  properties: {
    transferId: { type: 'string', minLength: 1, maxLength: 64 },
  },
} as const;

const auditEventSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'eventId',
    'eventType',
    'occurredAt',
    'aggregateType',
    'aggregateId',
    'correlationId',
    'actorUserId',
    'visibleToUserIds',
    'data',
  ],
  properties: {
    eventId: { type: 'string' },
    eventType: { type: 'string' },
    occurredAt: { type: 'string' },
    aggregateType: { type: 'string' },
    aggregateId: { type: 'string' },
    correlationId: { type: ['string', 'null'] },
    actorUserId: { type: ['string', 'null'] },
    visibleToUserIds: { type: 'array', items: { type: 'string' } },
    data: { type: 'object', additionalProperties: true },
  },
} as const;

export const auditHistoryResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['transferId', 'events'],
  properties: {
    transferId: { type: 'string' },
    events: { type: 'array', items: auditEventSchema },
  },
} as const;

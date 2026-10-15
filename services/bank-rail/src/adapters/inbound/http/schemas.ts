// adapter: in — esquemas JSON de Fastify
export const transferBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reference', 'from', 'to', 'amount'],
  properties: {
    reference: { type: 'string', maxLength: 1024 },
    from: { type: 'string', maxLength: 1024 },
    to: { type: 'string', maxLength: 1024 },
    amount: { type: 'string', maxLength: 1024 },
  },
} as const;

export const reversalBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reference', 'originalReference', 'amount'],
  properties: {
    reference: { type: 'string', maxLength: 1024 },
    originalReference: { type: 'string', maxLength: 1024 },
    amount: { type: 'string', maxLength: 1024 },
  },
} as const;

export const referenceParamSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reference'],
  properties: {
    reference: { type: 'string', maxLength: 1024 },
  },
} as const;

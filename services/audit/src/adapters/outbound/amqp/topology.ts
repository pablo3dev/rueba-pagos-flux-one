// adapter: out — topología AMQP durable de auditoría
import type { Channel } from 'amqplib';

export const AUDIT_EXCHANGE = 'audit.events';
export const AUDIT_QUEUE = 'audit.transfer-events';
export const AUDIT_DLX = 'audit.dlx';
export const AUDIT_DLQ = 'audit.transfer-events.dlq';
export const AUDIT_DLQ_ROUTING_KEY = 'audit.transfer-events.dead';
export const AUDIT_BINDING = 'transfer.#';
export const AUDIT_PREFETCH = 10;
export const AUDIT_DELIVERY_LIMIT = 5;

export async function assertAuditTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(AUDIT_DLX, 'direct', { durable: true });
  await channel.assertQueue(AUDIT_DLQ, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });
  await channel.bindQueue(AUDIT_DLQ, AUDIT_DLX, AUDIT_DLQ_ROUTING_KEY);
  await channel.assertExchange(AUDIT_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(AUDIT_QUEUE, {
    durable: true,
    arguments: {
      'x-queue-type': 'quorum',
      'x-dead-letter-exchange': AUDIT_DLX,
      'x-dead-letter-routing-key': AUDIT_DLQ_ROUTING_KEY,
      'x-delivery-limit': AUDIT_DELIVERY_LIMIT,
    },
  });
  await channel.bindQueue(AUDIT_QUEUE, AUDIT_EXCHANGE, AUDIT_BINDING);
}

// adapter: in — consumidor AMQP de eventos de transferencia
import type { Channel, ConsumeMessage } from 'amqplib';
import type { AuditEntryRepository } from '../../../application/ports/audit-entry-repository.js';
import { recordAuditEvent } from '../../../application/use-cases/record-audit-event.js';
import { AUDIT_PREFETCH, AUDIT_QUEUE } from '../../outbound/amqp/topology.js';

export interface AuditLog {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

function messageId(message: ConsumeMessage): string | undefined {
  const id = message.properties.messageId;
  return typeof id === 'string' ? id : undefined;
}

// Ack solo después de que la escritura confirma. Un sobre inválido va a la DLQ (nack sin requeue).
// Un fallo de base de datos se reencola; el quorum lo mueve a la DLQ al superar x-delivery-limit.
export async function consumeAuditEvents(
  channel: Channel,
  repository: AuditEntryRepository,
  log: AuditLog,
): Promise<void> {
  await channel.prefetch(AUDIT_PREFETCH);
  await channel.consume(
    AUDIT_QUEUE,
    (message) => {
      if (message === null) return;
      void handle(channel, repository, log, message);
    },
    { noAck: false },
  );
}

async function handle(
  channel: Channel,
  repository: AuditEntryRepository,
  log: AuditLog,
  message: ConsumeMessage,
): Promise<void> {
  const outcome = await recordAuditEvent(
    { body: message.content, messageId: messageId(message) },
    repository,
  );

  try {
    if (outcome.action === 'ack') {
      channel.ack(message);
      log.info(
        {
          event: outcome.kind === 'inserted' ? 'audit.consumed' : 'audit.duplicate',
          eventId: outcome.eventId,
          correlationId: outcome.correlationId,
        },
        outcome.kind === 'inserted' ? 'audit event stored' : 'audit event duplicate',
      );
      return;
    }

    if (outcome.action === 'requeue') {
      channel.nack(message, false, true);
      log.warn(
        { event: 'audit.retry', eventId: outcome.eventId, correlationId: outcome.correlationId },
        'audit event requeued',
      );
      return;
    }

    channel.nack(message, false, false);
    log.warn({ event: 'audit.dead_lettered', reason: outcome.reason }, 'audit event dead-lettered');
  } catch (error) {
    const text = error instanceof Error ? error.message : 'ack failed';
    log.error({ event: 'audit.ack_failed', error: text }, 'audit ack failed');
  }
}

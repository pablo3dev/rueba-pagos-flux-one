import { describe, expect, it } from 'vitest';
import type { AuditEntryRepository } from '../../src/application/ports/audit-entry-repository.js';
import { recordAuditEvent } from '../../src/application/use-cases/record-audit-event.js';
import type { AuditEntry } from '../../src/domain/audit-entry.js';

const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = '11111111-1111-4111-8111-111111111111';
const transferId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function envelope(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(
    JSON.stringify({
      eventId,
      eventType: 'transfer.created',
      occurredAt: '2026-10-15T12:00:00.000Z',
      aggregateType: 'TRANSFER',
      aggregateId: transferId,
      correlationId: 'corr-1',
      actorUserId: userId,
      visibleToUserIds: [userId],
      data: { transferId, type: 'INTERNAL', amount: '1.00', status: 'COMPLETED' },
      ...overrides,
    }),
  );
}

function memoryRepository(store: AuditEntry[]): AuditEntryRepository {
  return {
    async insertIfAbsent(entry) {
      if (store.some((existing) => existing.eventId === entry.eventId)) return 'duplicate';
      store.push(entry);
      return 'inserted';
    },
    async listVisible() {
      return store;
    },
  };
}

describe('recordAuditEvent', () => {
  it('acks the first delivery and a duplicate eventId without inserting again', async () => {
    const store: AuditEntry[] = [];
    const repository = memoryRepository(store);

    const first = await recordAuditEvent({ body: envelope(), messageId: eventId }, repository);
    const second = await recordAuditEvent(
      {
        body: envelope({ data: { transferId, amount: '99.00', status: 'FAILED' } }),
        messageId: eventId,
      },
      repository,
    );

    expect(first).toEqual({
      action: 'ack',
      kind: 'inserted',
      eventId,
      correlationId: 'corr-1',
    });
    expect(second).toEqual({
      action: 'ack',
      kind: 'duplicate',
      eventId,
      correlationId: 'corr-1',
    });
    expect(store).toHaveLength(1);
    expect(store[0]?.payload).toEqual({
      transferId,
      type: 'INTERNAL',
      amount: '1.00',
      status: 'COMPLETED',
    });
  });

  it('dead-letters a message that cannot be processed', async () => {
    const invalidJson = await recordAuditEvent(
      { body: Buffer.from('not-json'), messageId: undefined },
      memoryRepository([]),
    );
    const invalidType = await recordAuditEvent(
      { body: envelope({ eventType: 'transfer.other' }), messageId: eventId },
      memoryRepository([]),
    );

    expect(invalidJson).toEqual({ action: 'dead-letter', reason: 'invalid_json' });
    expect(invalidType).toEqual({ action: 'dead-letter', reason: 'invalid_event_type' });
  });

  it('requeues when persistence fails', async () => {
    const failing: AuditEntryRepository = {
      async insertIfAbsent() {
        throw new Error('db down');
      },
      async listVisible() {
        return [];
      },
    };

    const outcome = await recordAuditEvent({ body: envelope(), messageId: eventId }, failing);

    expect(outcome).toEqual({
      action: 'requeue',
      eventId,
      correlationId: 'corr-1',
    });
  });
});

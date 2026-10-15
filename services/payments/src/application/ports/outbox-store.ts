// port: out — outbox que el caso de uso necesita
import type { OutboxEvent } from '../../domain/outbox-event.js';

export interface OutboxStore {
  insert(event: OutboxEvent): Promise<void>;
  claim(now: Date, limit: number): Promise<OutboxEvent[]>;
  markPublished(id: string, now: Date): Promise<void>;
  markRetry(id: string, attempts: number, nextAttemptAt: Date, lastError: string): Promise<void>;
}

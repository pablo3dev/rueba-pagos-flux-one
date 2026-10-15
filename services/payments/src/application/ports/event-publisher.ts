// port: out — publicación confirmada que el relay necesita
import type { OutboxEvent } from '../../domain/outbox-event.js';

export interface EventPublisher {
  publish(event: OutboxEvent): Promise<void>;
}

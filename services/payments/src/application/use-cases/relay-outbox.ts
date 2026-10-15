// port: in — publicar el outbox a RabbitMQ con reintento; un fallo del broker no revierte el negocio
import type { Clock } from '../ports/clock.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import type { Logger } from '../ports/logger.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { OUTBOX_BATCH_SIZE, outboxBackoffSeconds } from '../rail-work.js';

export class RelayOutbox {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly publisher: EventPublisher,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<number> {
    const now = this.clock.now();
    return this.unitOfWork.run(async ({ outbox }) => {
      const claimed = await outbox.claim(now, OUTBOX_BATCH_SIZE);
      for (const event of claimed) {
        try {
          await this.publisher.publish(event);
          await outbox.markPublished(event.id, this.clock.now());
          this.logger.info(
            {
              event: 'outbox.published',
              eventId: event.id,
              eventType: event.eventType,
              aggregateId: event.aggregateId,
            },
            'evento publicado',
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'error de broker';
          const waitSeconds = outboxBackoffSeconds(event.attempts);
          const nextAttemptAt = new Date(this.clock.now().getTime() + waitSeconds * 1000);
          await outbox.markRetry(event.id, event.attempts + 1, nextAttemptAt, message.slice(0, 500));
          this.logger.error(
            { event: 'outbox.publish_failed', eventId: event.id, attempts: event.attempts + 1, err: error },
            'reintento de outbox',
          );
        }
      }
      return claimed.length;
    }, { timeouts: false });
  }
}

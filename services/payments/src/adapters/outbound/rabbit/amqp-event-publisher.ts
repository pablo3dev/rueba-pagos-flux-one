// adapter: out — amqplib (publicación confirmada al exchange audit.events)
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import type { Logger } from '../../../application/ports/logger.js';
import type { EventPublisher } from '../../../application/ports/event-publisher.js';
import type { OutboxEvent } from '../../../domain/outbox-event.js';

export class AmqpEventPublisher implements EventPublisher {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private stopped = false;

  constructor(
    private readonly url: string,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.stopped = false;
    void this.connect();
  }

  async publish(event: OutboxEvent): Promise<void> {
    const channel = this.channel;
    if (!channel) throw new Error('broker no disponible');
    channel.publish('audit.events', event.eventType, Buffer.from(JSON.stringify(event.payload)), {
      persistent: true,
      messageId: event.id,
      contentType: 'application/json',
      timestamp: Date.now(),
    });
    await channel.waitForConfirms();
  }

  async close(): Promise<void> {
    this.stopped = true;
    this.channel = null;
    await this.connection?.close();
    this.connection = null;
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    try {
      const connection = await amqp.connect(this.url);
      connection.on('error', (error: Error) => {
        this.logger.error({ event: 'outbox.broker_error', message: error.message }, 'error de broker');
      });
      connection.on('close', () => {
        this.channel = null;
        this.connection = null;
        if (!this.stopped) setTimeout(() => void this.connect(), 3000);
      });
      const channel = await connection.createConfirmChannel();
      await channel.assertExchange('audit.dlx', 'direct', { durable: true });
      await channel.assertQueue('audit.transfer-events.dlq', {
        durable: true,
        arguments: { 'x-queue-type': 'quorum' },
      });
      await channel.bindQueue('audit.transfer-events.dlq', 'audit.dlx', 'audit.transfer-events.dead');
      await channel.assertExchange('audit.events', 'topic', { durable: true });
      await channel.assertQueue('audit.transfer-events', {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-dead-letter-exchange': 'audit.dlx',
          'x-dead-letter-routing-key': 'audit.transfer-events.dead',
          'x-delivery-limit': 5,
        },
      });
      await channel.bindQueue('audit.transfer-events', 'audit.events', 'transfer.#');
      this.connection = connection;
      this.channel = channel;
    } catch (error) {
      this.channel = null;
      this.logger.error({ event: 'outbox.broker_unavailable', err: error }, 'reintento de conexión al broker');
      if (!this.stopped) setTimeout(() => void this.connect(), 3000);
    }
  }
}

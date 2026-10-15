// adapter: in — conexión AMQP, reconexión y consumo de audit.transfer-events
import amqp from 'amqplib';
import type { ChannelModel } from 'amqplib';
import type { AuditEntryRepository } from '../../../application/ports/audit-entry-repository.js';
import { assertAuditTopology } from '../../outbound/amqp/topology.js';
import { consumeAuditEvents } from './consume-audit-events.js';
import type { AuditLog } from './consume-audit-events.js';

const RETRY_MS = 3000;

export interface AuditBroker {
  start(): Promise<void>;
  stop(): Promise<void>;
  isReady(): boolean;
}

export function startAuditBroker(options: {
  url: string;
  repository: AuditEntryRepository;
  log: AuditLog;
}): AuditBroker {
  let stopped = false;
  let ready = false;
  let connection: ChannelModel | null = null;
  let retry: NodeJS.Timeout | null = null;
  let retryPending = false;

  const schedule = (): void => {
    if (stopped || retryPending) return;
    retryPending = true;
    retry = setTimeout(() => {
      retry = null;
      retryPending = false;
      void connect();
    }, RETRY_MS);
  };

  const connect = async (): Promise<void> => {
    if (stopped) return;
    try {
      const conn = await amqp.connect(options.url);
      connection = conn;
      conn.on('error', (error: Error) => {
        options.log.error(
          { event: 'audit.broker_error', error: error.message },
          'amqp connection error',
        );
      });
      conn.on('close', () => {
        ready = false;
        connection = null;
        if (!stopped) schedule();
      });

      const channel = await conn.createChannel();
      await assertAuditTopology(channel);
      await consumeAuditEvents(channel, options.repository, options.log);
      ready = true;
    } catch (error) {
      ready = false;
      const text = error instanceof Error ? error.message : 'amqp connect failed';
      options.log.warn({ event: 'audit.broker_retry', error: text }, 'amqp connect failed');
      if (connection !== null) {
        const current = connection;
        connection = null;
        try {
          await current.close();
        } catch {
          // El evento close reintenta; si el cierre ya no emite, reintentamos aquí.
        }
      }
      schedule();
    }
  };

  return {
    start: connect,
    isReady: () => ready,
    stop: async () => {
      stopped = true;
      ready = false;
      if (retry !== null) clearTimeout(retry);
      retry = null;
      retryPending = false;
      const current = connection;
      connection = null;
      if (current !== null) {
        try {
          await current.close();
        } catch {
          // El cierre durante el apagado no es un fallo de negocio.
        }
      }
    },
  };
}

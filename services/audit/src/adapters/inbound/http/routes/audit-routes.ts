// adapter: in — Fastify (GET /audit/transfers/:transferId/events)
import type { FastifyInstance } from 'fastify';
import type { AccessTokenVerifier } from '../../../../application/ports/access-token-verifier.js';
import type { AuditEntryRepository } from '../../../../application/ports/audit-entry-repository.js';
import { listTransferEvents } from '../../../../application/use-cases/list-transfer-events.js';
import type { AuditEntry } from '../../../../domain/audit-entry.js';
import { UnauthorizedError } from '../../../../domain/errors.js';
import {
  auditHistoryResponseSchema,
  errorResponseSchema,
  transferIdParamsSchema,
} from '../schemas.js';

const BEARER_HEADER = /^Bearer\s+(\S+)$/i;

function readBearerToken(authorization: string | undefined): string {
  const token = authorization === undefined ? undefined : BEARER_HEADER.exec(authorization)?.[1];
  if (token === undefined) throw new UnauthorizedError();
  return token;
}

function toJson(entry: AuditEntry) {
  return {
    eventId: entry.eventId,
    eventType: entry.eventType,
    occurredAt: entry.occurredAt.toISOString(),
    aggregateType: entry.aggregateType,
    aggregateId: entry.aggregateId,
    correlationId: entry.correlationId,
    actorUserId: entry.actorUserId,
    visibleToUserIds: entry.visibleToUserIds,
    data: entry.payload,
  };
}

export async function auditRoutes(
  app: FastifyInstance,
  deps: { verifier: AccessTokenVerifier; repository: AuditEntryRepository },
): Promise<void> {
  // Lectura pura: naturalmente idempotente. 404 si el usuario no ve ningún evento.
  app.get<{ Params: { transferId: string } }>(
    '/audit/transfers/:transferId/events',
    {
      schema: {
        params: transferIdParamsSchema,
        response: {
          200: auditHistoryResponseSchema,
          '4xx': errorResponseSchema,
        },
      },
    },
    async (request) => {
      const accessToken = readBearerToken(request.headers.authorization);
      const { userId } = await deps.verifier.verify(accessToken);
      const events = await listTransferEvents(
        { transferId: request.params.transferId, userId },
        deps.repository,
      );
      return { transferId: request.params.transferId.toLowerCase(), events: events.map(toJson) };
    },
  );
}

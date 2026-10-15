import type { AuditEvent } from '../domain/types';
import { isApiError } from './api-error';
import type { HttpClient } from './http-client';

export interface AuditApi {
  listEvents(transferId: string): Promise<AuditEvent[]>;
}

function asEvents(body: unknown): AuditEvent[] {
  if (Array.isArray(body)) return body as AuditEvent[];
  if (body && typeof body === 'object') {
    const record = body as { items?: unknown; events?: unknown };
    if (Array.isArray(record.items)) return record.items as AuditEvent[];
    if (Array.isArray(record.events)) return record.events as AuditEvent[];
  }
  return [];
}

export function createAuditApi(client: HttpClient): AuditApi {
  return {
    async listEvents(transferId) {
      try {
        const body = await client.request<unknown>({
          method: 'GET',
          base: '/api/audit',
          path: `/audit/transfers/${encodeURIComponent(transferId)}/events`,
          authenticated: true,
        });
        return asEvents(body)
          .slice()
          .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
      } catch (error) {
        if (isApiError(error) && error.status === 404) return [];
        throw error;
      }
    },
  };
}

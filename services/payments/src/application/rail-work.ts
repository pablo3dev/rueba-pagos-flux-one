import type { Logger } from './ports/logger.js';
import type { UnitOfWork } from './ports/unit-of-work.js';
import type { IdGenerator } from './ports/id-generator.js';
import { eventForTransferStatus, type OutboxEvent } from '../domain/outbox-event.js';
import type { RailTransition } from '../domain/external-transfer.js';
import type { Transfer } from '../domain/transfer.js';

export const BATCH_SIZE = 10;
export const LEASE_MS = 30_000;
export const OUTBOX_BATCH_SIZE = 50;
export const OUTBOX_MAX_BACKOFF_SECONDS = 60;

export function outboxBackoffSeconds(attempts: number): number {
  if (attempts >= 6) return OUTBOX_MAX_BACKOFF_SECONDS;
  return Math.min(2 ** attempts, OUTBOX_MAX_BACKOFF_SECONDS);
}

export async function applyRailTransition(
  deps: { unitOfWork: UnitOfWork; ids: IdGenerator; logger: Logger },
  claimed: Transfer,
  transition: RailTransition,
  now: Date,
): Promise<boolean> {
  const event = eventForTransferStatus({
    transfer: { ...transition.next, updatedAt: now },
    eventId: deps.ids.newId(),
    previousStatus: claimed.status,
    visibleToUserIds: [claimed.ownerUserId],
    actorUserId: null,
  });
  if (!claimed.leaseUntil) throw new Error('arrendamiento ausente');
  const leaseUntil = claimed.leaseUntil;
  const applied = await deps.unitOfWork.run(async ({ railWork, accounts, outbox }) => {
    const saved = await railWork.saveGuarded(transition.next, {
      status: claimed.status,
      leaseUntil,
    });
    if (!saved) return false;
    if (transition.refund) {
      await accounts.lockByIds([claimed.fromAccountId]);
      await accounts.credit(claimed.fromAccountId, claimed.amount, now);
    }
    if (event) await outbox.insert(event);
    return true;
  });
  logRail(deps.logger, claimed, transition, applied, event);
  return applied;
}

function logRail(
  logger: Logger,
  claimed: Transfer,
  transition: RailTransition,
  applied: boolean,
  event: OutboxEvent | null,
): void {
  const base = { transferId: claimed.id, correlationId: claimed.correlationId };
  if (!applied) {
    logger.warn({ event: 'rail.result_discarded', ...base, outcome: transition.next.lastRailOutcome }, 'resultado descartado');
    return;
  }
  if (event) {
    logger.info(
      {
        event: 'transfer.status_changed',
        ...base,
        from: claimed.status,
        to: transition.next.status,
        failureReason: transition.next.failureReason,
        refunded: transition.refund,
      },
      'estado actualizado',
    );
    return;
  }
  logger.info(
    {
      event: 'rail.retry_scheduled',
      ...base,
      action: 'SUBMIT',
      railAttempts: transition.next.railAttempts,
      nextAttemptAt: transition.next.nextAttemptAt?.toISOString() ?? null,
    },
    'reintento programado',
  );
}

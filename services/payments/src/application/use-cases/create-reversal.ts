// port: in — reversar una transferencia completada, una sola vez
// Idempotencia: operación CREATE_REVERSAL:<transferId>, misma transacción que el movimiento y el outbox.
import {
  IdempotencyKeyPayloadMismatchError,
  TransferAlreadyReversedError,
  TransferNotFoundError,
  TransferNotReversibleError,
} from '../../domain/errors.js';
import { computeRequestHash, reversalOperation } from '../../domain/idempotency.js';
import { eventForReversal } from '../../domain/outbox-event.js';
import { planExternalReversal, planInternalReversal } from '../../domain/reversal.js';
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { toReversalView, type ReversalView } from '../views.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateReversalResult {
  replayed: boolean;
  status: 201 | 202;
  reversal: ReversalView;
}

export class CreateReversal {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    userId: string;
    transferId: string;
    idempotencyKey: string;
    body: Record<string, never>;
    correlationId: string | null;
  }): Promise<CreateReversalResult> {
    if (!UUID.test(input.transferId)) throw new TransferNotFoundError();
    const operation = reversalOperation(input.transferId);
    const requestHash = computeRequestHash(operation, input.body);
    const scope = { userId: input.userId, operation, key: input.idempotencyKey };
    return this.unitOfWork.run(async ({ accounts, transfers, reversals, idempotency, outbox }) => {
      const begun = await idempotency.begin(scope, requestHash, this.clock.now());
      if (begun.kind === 'MISMATCH') throw new IdempotencyKeyPayloadMismatchError();
      if (begun.kind === 'REPLAY') {
        return {
          replayed: true,
          status: begun.status as 201 | 202,
          reversal: begun.body as ReversalView,
        };
      }
      const transfer = await transfers.findVisibleById(input.transferId, input.userId);
      if (!transfer) throw new TransferNotFoundError();
      if (transfer.ownerUserId !== input.userId) throw new TransferNotReversibleError();
      const active = await reversals.findActiveByTransferId(transfer.id);
      if (transfer.status === 'REVERSED' || active) throw new TransferAlreadyReversedError();
      if (transfer.status !== 'COMPLETED') throw new TransferNotReversibleError();
      const now = this.clock.now();
      const reversalId = this.ids.newId();
      if (transfer.type === 'INTERNAL') {
        const destinationId = transfer.toAccountId;
        if (!destinationId) throw new TransferNotReversibleError();
        const locked = await accounts.lockByIds([transfer.fromAccountId, destinationId]);
        const from = locked.find((account) => account.id === transfer.fromAccountId);
        const to = locked.find((account) => account.id === destinationId);
        if (!from || !to) throw new TransferNotReversibleError();
        const plan = planInternalReversal({
          reversalId,
          transfer,
          from,
          to,
          requestedByUserId: input.userId,
          correlationId: input.correlationId,
          now,
        });
        const debited = await accounts.debit(to.id, transfer.amount, now);
        if (!debited) throw new Error('el débito del destino no aplicó');
        await accounts.credit(from.id, transfer.amount, now);
        const marked = await transfers.markReversed(transfer.id, now);
        if (!marked) throw new TransferAlreadyReversedError();
        await reversals.insert(plan.reversal);
        const view = toReversalView(plan.reversal);
        await outbox.insert(
          eventForReversal({
            transfer,
            reversal: plan.reversal,
            eventId: this.ids.newId(),
            visibleToUserIds: [from.ownerUserId, to.ownerUserId],
            actorUserId: input.userId,
            kind: 'reversed',
          }),
        );
        await idempotency.complete(scope, { status: 201, body: view, resourceId: plan.reversal.id }, now);
        return { replayed: false, status: 201, reversal: view };
      }
      const reversal = planExternalReversal({
        reversalId,
        transfer,
        requestedByUserId: input.userId,
        correlationId: input.correlationId,
        now,
      });
      await reversals.insert(reversal);
      const view = toReversalView(reversal);
      await outbox.insert(
        eventForReversal({
          transfer,
          reversal,
          eventId: this.ids.newId(),
          visibleToUserIds: [transfer.ownerUserId],
          actorUserId: input.userId,
          kind: 'requested',
        }),
      );
      await idempotency.complete(scope, { status: 202, body: view, resourceId: reversal.id }, now);
      return { replayed: false, status: 202, reversal: view };
    });
  }
}

// port: in — despachar y conciliar reversos externos contra el riel
import { eventForReversal } from '../../domain/outbox-event.js';
import {
  applyReversalQueryOutcome,
  applyReversalSubmitOutcome,
  type Reversal,
  type ReversalTransition,
} from '../../domain/reversal.js';
import type { BankRailPort } from '../ports/bank-rail-port.js';
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { Logger } from '../ports/logger.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { BATCH_SIZE, LEASE_MS } from '../rail-work.js';
import type { RailOutcome } from '../../domain/transfer.js';

export class DispatchReversals {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bank: BankRailPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<number> {
    const deps = { unitOfWork: this.unitOfWork, clock: this.clock, ids: this.ids, logger: this.logger };
    return processReversals(deps, 'DISPATCH', async (reversal) => {
      const outcome = await this.bank.submitReversal({
        reference: reversal.railReference ?? reversal.id,
        originalReference: reversal.transferId,
        amount: reversal.amount,
        correlationId: reversal.correlationId,
      });
      return applyReversalSubmitOutcome(reversal, outcome, this.clock.now());
    });
  }
}

export class ReconcileReversals {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bank: BankRailPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<number> {
    const deps = { unitOfWork: this.unitOfWork, clock: this.clock, ids: this.ids, logger: this.logger };
    return processReversals(deps, 'RECONCILE', async (reversal) => {
      const outcome: RailOutcome = await this.bank.query({
        reference: reversal.railReference ?? reversal.id,
        correlationId: reversal.correlationId,
      });
      const decidedAt = this.clock.now();
      const transition = applyReversalQueryOutcome(reversal, outcome, decidedAt);
      this.logger.info(
        {
          event: 'reconcile.result',
          transferId: reversal.transferId,
          correlationId: reversal.correlationId,
          outcome,
          resultingStatus: transition.next.status,
        },
        'conciliación de reverso',
      );
      return transition;
    });
  }
}

interface ReversalWorkerDeps {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
}

async function processReversals(
  deps: ReversalWorkerDeps,
  kind: 'DISPATCH' | 'RECONCILE',
  decide: (reversal: Reversal) => Promise<ReversalTransition>,
): Promise<number> {
  const now = deps.clock.now();
  const claimed = await deps.unitOfWork.run(({ reversalWork }) =>
    reversalWork.claim(kind, now, new Date(now.getTime() + LEASE_MS), BATCH_SIZE),
  );
  await Promise.all(
    claimed.map(async (reversal) => {
      try {
        const transition = await decide(reversal);
        await applyReversalTransition(deps, reversal, transition);
      } catch (error) {
        deps.logger.error(
          { event: 'reversal.worker_failed', transferId: reversal.transferId, err: error },
          'fallo de reverso',
        );
      }
    }),
  );
  return claimed.length;
}

async function applyReversalTransition(
  deps: ReversalWorkerDeps,
  claimed: Reversal,
  transition: ReversalTransition,
): Promise<void> {
  if (!claimed.leaseUntil) throw new Error('arrendamiento de reverso ausente');
  const leaseUntil = claimed.leaseUntil;
  await deps.unitOfWork.run(async ({ reversalWork, accounts, transfers, outbox }) => {
    const transfer = await transfers.findById(claimed.transferId);
    if (!transfer) throw new Error('transferencia del reverso no encontrada');
    const saved = await reversalWork.saveGuarded(transition.next, {
      status: claimed.status,
      leaseUntil,
    });
    if (!saved) return;
    if (transition.creditOrigin) {
      await accounts.lockByIds([transfer.fromAccountId]);
      await accounts.credit(transfer.fromAccountId, claimed.amount, transition.next.updatedAt);
    }
    if (transition.reverseTransfer) {
      const marked = await transfers.markReversed(claimed.transferId, transition.next.updatedAt);
      if (!marked) throw new Error('la transferencia ya no está COMPLETED');
    }
    if (transition.next.status === 'COMPLETED' || transition.next.status === 'REJECTED') {
      await outbox.insert(
        eventForReversal({
          transfer,
          reversal: transition.next,
          eventId: deps.ids.newId(),
          visibleToUserIds: [transfer.ownerUserId],
          actorUserId: null,
          kind: transition.next.status === 'COMPLETED' ? 'reversed' : 'rejected',
        }),
      );
    }
  });
}

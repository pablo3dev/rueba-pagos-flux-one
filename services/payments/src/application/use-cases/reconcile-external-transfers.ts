// port: in — conciliar transferencias externas UNKNOWN consultando al riel
import { applyQueryOutcome } from '../../domain/external-transfer.js';
import type { BankRailPort } from '../ports/bank-rail-port.js';
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { Logger } from '../ports/logger.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { applyRailTransition, BATCH_SIZE, LEASE_MS } from '../rail-work.js';

export class ReconcileExternalTransfers {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bank: BankRailPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<number> {
    const now = this.clock.now();
    const claimed = await this.unitOfWork.run(({ railWork }) =>
      railWork.claim('RECONCILE', now, new Date(now.getTime() + LEASE_MS), BATCH_SIZE),
    );
    await Promise.all(
      claimed.map(async (transfer) => {
        try {
          const outcome = await this.bank.query({
            reference: transfer.railReference ?? transfer.id,
            correlationId: transfer.correlationId,
          });
          const decidedAt = this.clock.now();
          const transition = applyQueryOutcome(transfer, outcome, decidedAt);
          const applied = await applyRailTransition(
            { unitOfWork: this.unitOfWork, ids: this.ids, logger: this.logger },
            transfer,
            transition,
            decidedAt,
          );
          this.logger.info(
            {
              event: 'reconcile.result',
              transferId: transfer.id,
              correlationId: transfer.correlationId,
              outcome,
              resultingStatus: applied ? transition.next.status : transfer.status,
            },
            'resultado de conciliación',
          );
        } catch (error) {
          this.logger.error(
            { event: 'reconcile.failed', transferId: transfer.id, err: error },
            'fallo de conciliación',
          );
        }
      }),
    );
    return claimed.length;
  }
}

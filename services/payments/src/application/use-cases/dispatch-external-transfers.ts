// port: in — enviar transferencias externas pendientes al riel, fuera de la transacción de base de datos
import { applySubmitOutcome } from '../../domain/external-transfer.js';
import type { BankRailPort } from '../ports/bank-rail-port.js';
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { Logger } from '../ports/logger.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { applyRailTransition, BATCH_SIZE, LEASE_MS } from '../rail-work.js';

export class DispatchExternalTransfers {
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
      railWork.claim('DISPATCH', now, new Date(now.getTime() + LEASE_MS), BATCH_SIZE),
    );
    await Promise.all(
      claimed.map(async (transfer) => {
        try {
          const outcome = await this.bank.submit({
            reference: transfer.railReference ?? transfer.id,
            from: transfer.fromAccountId,
            to: transfer.toExternalAccount ?? '',
            amount: transfer.amount,
            correlationId: transfer.correlationId,
          });
          const decidedAt = this.clock.now();
          const transition = applySubmitOutcome(transfer, outcome, decidedAt);
          await applyRailTransition(
            { unitOfWork: this.unitOfWork, ids: this.ids, logger: this.logger },
            transfer,
            transition,
            decidedAt,
          );
        } catch (error) {
          this.logger.error({ event: 'rail.dispatch_failed', transferId: transfer.id, err: error }, 'fallo de despacho');
        }
      }),
    );
    return claimed.length;
  }
}

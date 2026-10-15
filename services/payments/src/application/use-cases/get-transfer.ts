// port: in — consultar una transferencia visible
import { TransferNotFoundError } from '../../domain/errors.js';
import type { ReversalRepository } from '../ports/reversal-repository.js';
import type { TransferRepository } from '../ports/transfer-repository.js';
import { toReversalView, toTransferView, type TransferDetailView } from '../views.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GetTransfer {
  constructor(
    private readonly transfers: TransferRepository,
    private readonly reversals: ReversalRepository,
  ) {}

  async execute(input: { userId: string; transferId: string }): Promise<TransferDetailView> {
    if (!UUID.test(input.transferId)) throw new TransferNotFoundError();
    const transfer = await this.transfers.findVisibleById(input.transferId, input.userId);
    if (!transfer) throw new TransferNotFoundError();
    const reversal = await this.reversals.findLatestByTransferId(transfer.id);
    return { ...toTransferView(transfer), reversal: reversal ? toReversalView(reversal) : null };
  }
}

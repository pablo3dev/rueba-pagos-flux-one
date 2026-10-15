// port: in — crear una transferencia interna o externa
// Idempotencia: la fila de idempotency_keys y el outbox se confirman en la misma transacción del débito.
import {
  AccountNotFoundError,
  DestinationNotFoundError,
  IdempotencyKeyPayloadMismatchError,
  SameAccountError,
} from '../../domain/errors.js';
import { createExternalTransfer, parseExternalAccount } from '../../domain/external-transfer.js';
import { CREATE_TRANSFER_OPERATION, computeRequestHash } from '../../domain/idempotency.js';
import { parseAmount } from '../../domain/money.js';
import { eventsForNewTransfer } from '../../domain/outbox-event.js';
import { executeInternalTransfer } from '../../domain/transfer.js';
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import { toTransferView, type TransferView } from '../views.js';

export type CreateTransferBody =
  | { type: 'INTERNAL'; fromAccountId: string; toAccountId: string; amount: unknown }
  | { type: 'EXTERNAL'; fromAccountId: string; toExternalAccount: string; amount: unknown };

export interface CreateTransferResult {
  replayed: boolean;
  status: 201 | 202;
  transfer: TransferView;
}

export class CreateTransfer {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    userId: string;
    idempotencyKey: string;
    body: CreateTransferBody;
    correlationId: string | null;
  }): Promise<CreateTransferResult> {
    const amount = parseAmount(input.body.amount);
    if (input.body.type === 'INTERNAL' && input.body.fromAccountId === input.body.toAccountId) {
      throw new SameAccountError();
    }
    const externalAccount =
      input.body.type === 'EXTERNAL' ? parseExternalAccount(input.body.toExternalAccount) : null;
    const requestHash = computeRequestHash(CREATE_TRANSFER_OPERATION, input.body);
    const scope = { userId: input.userId, operation: CREATE_TRANSFER_OPERATION, key: input.idempotencyKey };
    return this.unitOfWork.run(async ({ accounts, transfers, idempotency, outbox }) => {
      const begun = await idempotency.begin(scope, requestHash, this.clock.now());
      if (begun.kind === 'MISMATCH') throw new IdempotencyKeyPayloadMismatchError();
      if (begun.kind === 'REPLAY') {
        return { replayed: true, status: begun.status as 201 | 202, transfer: begun.body as TransferView };
      }
      if (input.body.type === 'EXTERNAL') {
        const locked = await accounts.lockByIds([input.body.fromAccountId]);
        const from = locked.find((account) => account.id === input.body.fromAccountId);
        if (!from || from.ownerUserId !== input.userId) throw new AccountNotFoundError();
        const now = this.clock.now();
        const created = createExternalTransfer({
          id: this.ids.newId(),
          ownerUserId: input.userId,
          from,
          toExternalAccount: externalAccount ?? '',
          amount,
          correlationId: input.correlationId,
          now,
        });
        if (created.transfer.status === 'PENDING') {
          const debited = await accounts.debit(from.id, amount, now);
          if (!debited) throw new Error('el débito condicional no aplicó');
        }
        await transfers.insert(created.transfer);
        const view = toTransferView(created.transfer);
        const status = created.transfer.status === 'PENDING' ? 202 : 201;
        for (const event of eventsForNewTransfer({
          transfer: created.transfer,
          visibleToUserIds: [from.ownerUserId],
          actorUserId: input.userId,
          createdEventId: this.ids.newId(),
          statusEventId: this.ids.newId(),
        })) {
          await outbox.insert(event);
        }
        await idempotency.complete(scope, { status, body: view, resourceId: created.transfer.id }, now);
        return { replayed: false, status, transfer: view };
      }
      const internal = input.body;
      if (internal.type !== 'INTERNAL') throw new Error('tipo de transferencia inesperado');
      const locked = await accounts.lockByIds([internal.fromAccountId, internal.toAccountId]);
      const from = locked.find((account) => account.id === internal.fromAccountId);
      const to = locked.find((account) => account.id === internal.toAccountId);
      if (!from || from.ownerUserId !== input.userId) throw new AccountNotFoundError();
      if (!to) throw new DestinationNotFoundError();
      const now = this.clock.now();
      const outcome = executeInternalTransfer({
        id: this.ids.newId(),
        ownerUserId: input.userId,
        from,
        to,
        amount,
        correlationId: input.correlationId,
        now,
      });
      if (outcome.transfer.status === 'COMPLETED') {
        const debited = await accounts.debit(from.id, amount, now);
        if (!debited) throw new Error('el débito condicional no aplicó');
        await accounts.credit(to.id, amount, now);
      }
      await transfers.insert(outcome.transfer);
      const view = toTransferView(outcome.transfer);
      for (const event of eventsForNewTransfer({
        transfer: outcome.transfer,
        visibleToUserIds: [from.ownerUserId, to.ownerUserId],
        actorUserId: input.userId,
        createdEventId: this.ids.newId(),
        statusEventId: this.ids.newId(),
      })) {
        await outbox.insert(event);
      }
      await idempotency.complete(scope, { status: 201, body: view, resourceId: outcome.transfer.id }, now);
      return { replayed: false, status: 201, transfer: view };
    });
  }
}

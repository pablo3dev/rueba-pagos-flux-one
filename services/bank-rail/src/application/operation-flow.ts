import { ReferenceConflictError } from '../domain/errors.js';
import { buildOperation, isSamePayload } from '../domain/operation.js';
import type { RejectionReason } from '../domain/operation.js';
import type { OperationRequest } from '../domain/requests.js';
import {
  responseOfRecorded,
  type OperationObserver,
  type OperationResponse,
} from './operation-result.js';
import type { Delay } from './ports/delay.js';
import type { Ledger } from './ports/ledger.js';
import type { OutcomePicker } from './ports/outcome-picker.js';
import type { SerialExecutor } from './serial-executor.js';

type SerializedStep =
  | { pendingWait: false; response: OperationResponse }
  | { pendingWait: true; processed: boolean; response: OperationResponse };

export class OperationFlow {
  constructor(
    private readonly deps: {
      ledger: Ledger;
      picker: OutcomePicker;
      delay: Delay;
      executor: SerialExecutor;
      timeoutDelayMs: number;
    },
  ) {}

  // Idempotente por reference: el mismo payload devuelve el resultado guardado
  // sin sortear, escribir ni esperar. Un payload distinto lanza ReferenceConflictError.
  // UNAVAILABLE y TIMEOUT no procesado no se registran y pueden reintentarse.
  async run(
    request: OperationRequest,
    observer: OperationObserver,
    rules?: () => Promise<RejectionReason | undefined>,
  ): Promise<OperationResponse> {
    const step = await this.deps.executor.run(async (): Promise<SerializedStep> => {
      const existing = await this.deps.ledger.find(request.reference);
      if (existing !== undefined) {
        if (!isSamePayload(existing, request)) {
          throw new ReferenceConflictError('La referencia ya existe con datos distintos.');
        }
        return { pendingWait: false, response: responseOfRecorded(existing) };
      }

      if (rules !== undefined) {
        const reason = await rules();
        if (reason !== undefined) {
          await this.deps.ledger.append(
            buildOperation(request, { status: 'REJECTED', reason }, this.deps.delay.now()),
          );
          return {
            pendingWait: false,
            response: { status: 'REJECTED', reference: request.reference, reason },
          };
        }
      }

      const outcome = this.deps.picker.pick();
      observer.outcomeChosen({
        reference: request.reference,
        kind: request.kind,
        outcome,
      });

      if (outcome === 'ACCEPTED') {
        await this.deps.ledger.append(
          buildOperation(request, { status: 'ACCEPTED' }, this.deps.delay.now()),
        );
        return {
          pendingWait: false,
          response: { status: 'ACCEPTED', reference: request.reference },
        };
      }

      if (outcome === 'REJECTED') {
        await this.deps.ledger.append(
          buildOperation(
            request,
            { status: 'REJECTED', reason: 'REJECTED_BY_BANK' },
            this.deps.delay.now(),
          ),
        );
        return {
          pendingWait: false,
          response: {
            status: 'REJECTED',
            reference: request.reference,
            reason: 'REJECTED_BY_BANK',
          },
        };
      }

      if (outcome === 'UNAVAILABLE') {
        return { pendingWait: false, response: { status: 'UNAVAILABLE' } };
      }

      const processed = this.deps.picker.pickTimeoutProcessed();
      if (processed) {
        await this.deps.ledger.append(
          buildOperation(request, { status: 'ACCEPTED' }, this.deps.delay.now()),
        );
      }
      const response: OperationResponse = processed
        ? { status: 'ACCEPTED', reference: request.reference }
        : { status: 'UNAVAILABLE' };
      return { pendingWait: true, processed, response };
    });

    if (step.pendingWait) {
      observer.timeout({
        reference: request.reference,
        kind: request.kind,
        processed: step.processed,
        delayMs: this.deps.timeoutDelayMs,
      });
      await this.deps.delay.wait(this.deps.timeoutDelayMs);
    }
    return step.response;
  }
}

import type { BankOperation, OperationKind, RejectionReason } from '../domain/operation.js';
import type { RailOutcome } from '../domain/outcome.js';

export type OperationResponse =
  | { status: 'ACCEPTED'; reference: string }
  | { status: 'REJECTED'; reference: string; reason: RejectionReason }
  | { status: 'UNAVAILABLE' };

export interface OperationObserver {
  outcomeChosen(event: { reference: string; kind: OperationKind; outcome: RailOutcome }): void;
  timeout(event: {
    reference: string;
    kind: OperationKind;
    processed: boolean;
    delayMs: number;
  }): void;
}

export const NOOP_OBSERVER: OperationObserver = {
  outcomeChosen() {},
  timeout() {},
};

export function responseOfRecorded(operation: BankOperation): OperationResponse {
  if (operation.status === 'ACCEPTED') {
    return { status: 'ACCEPTED', reference: operation.reference };
  }
  const reason = operation.reason;
  if (reason === undefined) {
    throw new Error('La operación rechazada no tiene motivo.');
  }
  return { status: 'REJECTED', reference: operation.reference, reason };
}

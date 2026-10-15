export interface TransferIntent {
  key: string;
  payload: string;
}

export type SubmitOutcome = 'effect' | 'retryable' | 'rotate';

export function intentForSubmit(
  current: TransferIntent | null,
  payload: string,
  newKey: () => string,
): TransferIntent {
  if (current && current.payload === payload) return current;
  return { key: newKey(), payload };
}

export function intentAfterResult(
  current: TransferIntent,
  outcome: SubmitOutcome,
): TransferIntent | null {
  if (outcome === 'retryable') return current;
  return null;
}

export function isRetryableFailure(status: number, code: string): boolean {
  return status === 0 || status >= 500 || code === 'IDEMPOTENCY_KEY_IN_PROGRESS';
}

export function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

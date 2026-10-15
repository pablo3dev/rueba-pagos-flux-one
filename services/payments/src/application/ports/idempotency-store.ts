// port: out — idempotencia que el caso de uso necesita
export interface IdempotencyScope {
  userId: string;
  operation: string;
  key: string;
}

export type BeginResult =
  | { kind: 'ACQUIRED' }
  | { kind: 'REPLAY'; status: number; body: unknown }
  | { kind: 'MISMATCH' };

export interface IdempotencyStore {
  begin(scope: IdempotencyScope, requestHash: string, now: Date): Promise<BeginResult>;
  complete(
    scope: IdempotencyScope,
    response: { status: number; body: unknown; resourceId: string },
    now: Date,
  ): Promise<void>;
}

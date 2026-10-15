import type { Delay } from '../../src/application/ports/delay.js';
import type { Ledger } from '../../src/application/ports/ledger.js';
import type { OutcomePicker } from '../../src/application/ports/outcome-picker.js';
import { LedgerUnavailableError } from '../../src/domain/errors.js';
import type { BankOperation } from '../../src/domain/operation.js';
import type { RailOutcome } from '../../src/domain/outcome.js';

export class SequenceOutcomePicker implements OutcomePicker {
  pickCalls = 0;
  timeoutCalls = 0;

  private pickIndex = 0;
  private timeoutIndex = 0;
  private readonly outcomes: readonly RailOutcome[];
  private readonly timeoutProcessed: readonly boolean[];

  constructor(options: { outcomes: RailOutcome[]; timeoutProcessed?: boolean[] }) {
    this.outcomes = options.outcomes;
    this.timeoutProcessed = options.timeoutProcessed ?? [];
  }

  pick(): RailOutcome {
    this.pickCalls += 1;
    const outcome = this.outcomes[this.pickIndex];
    this.pickIndex += 1;
    if (outcome === undefined) {
      throw new Error('No quedan resultados para sortear.');
    }
    return outcome;
  }

  pickTimeoutProcessed(): boolean {
    this.timeoutCalls += 1;
    const processed = this.timeoutProcessed[this.timeoutIndex];
    this.timeoutIndex += 1;
    if (processed === undefined) {
      throw new Error('No quedan resultados de timeout para sortear.');
    }
    return processed;
  }
}

export class FakeDelay implements Delay {
  readonly waits: number[] = [];

  private readonly gated: boolean;
  private readonly fixedNow: Date;
  private readonly pending: Array<() => void> = [];

  constructor(options?: { gated?: boolean; now?: Date }) {
    this.gated = options?.gated === true;
    this.fixedNow = options?.now ?? new Date(0);
  }

  wait(ms: number): Promise<void> {
    this.waits.push(ms);
    if (!this.gated) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.pending.push(resolve);
    });
  }

  release(): void {
    const pending = this.pending.splice(0);
    for (const resolve of pending) {
      resolve();
    }
  }

  now(): Date {
    return this.fixedNow;
  }
}

export class FlakyLedger implements Ledger {
  failReads = false;
  failWrites = false;

  constructor(private readonly inner: Ledger) {}

  async find(reference: string): Promise<BankOperation | undefined> {
    this.assertReads();
    return this.inner.find(reference);
  }

  async findAcceptedReversalOf(originalReference: string): Promise<BankOperation | undefined> {
    this.assertReads();
    return this.inner.findAcceptedReversalOf(originalReference);
  }

  async append(operation: BankOperation): Promise<void> {
    if (this.failWrites) {
      throw new LedgerUnavailableError('Fallo de escritura del ledger.');
    }
    await this.inner.append(operation);
  }

  private assertReads(): void {
    if (this.failReads) {
      throw new LedgerUnavailableError('Fallo de lectura del ledger.');
    }
  }
}

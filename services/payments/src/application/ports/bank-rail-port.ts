// port: out — riel bancario que el caso de uso necesita. Nunca lanza: todo fallo es un RailOutcome.
import type { Money } from '../../domain/money.js';
import type { RailOutcome } from '../../domain/transfer.js';

export interface RailSubmitInput {
  reference: string;
  from: string;
  to: string;
  amount: Money;
  correlationId: string | null;
}

export interface RailReversalInput {
  reference: string;
  originalReference: string;
  amount: Money;
  correlationId: string | null;
}

export interface RailQueryInput {
  reference: string;
  correlationId: string | null;
}

export interface BankRailPort {
  submit(input: RailSubmitInput): Promise<Exclude<RailOutcome, 'NOT_FOUND'>>;
  submitReversal(input: RailReversalInput): Promise<Exclude<RailOutcome, 'NOT_FOUND'>>;
  query(input: RailQueryInput): Promise<RailOutcome>;
}

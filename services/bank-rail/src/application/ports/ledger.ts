// port: out — consultar y registrar operaciones del riel
import type { BankOperation } from '../../domain/operation.js';

export interface Ledger {
  find(reference: string): Promise<BankOperation | undefined>;
  findAcceptedReversalOf(originalReference: string): Promise<BankOperation | undefined>;
  // Registra la operación; resuelve solo tras escribir. Falla con LedgerUnavailableError sin dejar la operación visible.
  append(operation: BankOperation): Promise<void>;
}

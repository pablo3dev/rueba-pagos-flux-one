// port: in — consultar una operación por referencia
import { isValidReference } from '../../domain/reference.js';
import { responseOfRecorded, type OperationResponse } from '../operation-result.js';
import type { Ledger } from '../ports/ledger.js';

export class GetOperation {
  constructor(private readonly deps: { ledger: Ledger }) {}

  // Lectura pura: no sortea ni escribe. Repetirla no cambia el ledger.
  async execute(reference: string): Promise<OperationResponse | undefined> {
    if (!isValidReference(reference)) {
      return undefined;
    }
    const operation = await this.deps.ledger.find(reference);
    if (operation === undefined) {
      return undefined;
    }
    return responseOfRecorded(operation);
  }
}

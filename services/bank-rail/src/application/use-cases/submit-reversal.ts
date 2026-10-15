// port: in — enviar un reverso al riel
import { parseReversalRequest } from '../../domain/requests.js';
import { decideReversalRejection } from '../../domain/reversal-rules.js';
import type { OperationFlow } from '../operation-flow.js';
import type { OperationObserver, OperationResponse } from '../operation-result.js';
import type { Ledger } from '../ports/ledger.js';

export class SubmitReversal {
  constructor(private readonly deps: { flow: OperationFlow; ledger: Ledger }) {}

  // El efecto queda en OperationFlow: idempotente por reference del cuerpo.
  // Las reglas se evalúan dentro de la misma sección serializada.
  async execute(body: unknown, observer: OperationObserver): Promise<OperationResponse> {
    const request = parseReversalRequest(body);
    return this.deps.flow.run(request, observer, async () => {
      const original = await this.deps.ledger.find(request.originalReference);
      const reversal =
        original === undefined
          ? undefined
          : await this.deps.ledger.findAcceptedReversalOf(original.reference);
      return decideReversalRejection(request, original, reversal);
    });
  }
}

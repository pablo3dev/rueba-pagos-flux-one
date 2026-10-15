// port: in — enviar una transferencia al riel
import { parseTransferRequest } from '../../domain/requests.js';
import type { OperationFlow } from '../operation-flow.js';
import type { OperationObserver, OperationResponse } from '../operation-result.js';

export class SubmitTransfer {
  constructor(private readonly deps: { flow: OperationFlow }) {}

  // El efecto queda en OperationFlow: idempotente por reference del cuerpo.
  async execute(body: unknown, observer: OperationObserver): Promise<OperationResponse> {
    const request = parseTransferRequest(body);
    return this.deps.flow.run(request, observer);
  }
}

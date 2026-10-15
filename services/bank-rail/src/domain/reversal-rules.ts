import { parseAmount } from './amount.js';
import type { BankOperation, RejectionReason } from './operation.js';
import type { ReversalRequest } from './requests.js';

export function decideReversalRejection(
  request: ReversalRequest,
  original: BankOperation | undefined,
  acceptedReversalOfOriginal: BankOperation | undefined,
): RejectionReason | undefined {
  if (original === undefined) {
    return 'ORIGINAL_NOT_FOUND';
  }
  if (original.status !== 'ACCEPTED' || original.kind !== 'TRANSFER') {
    return 'ORIGINAL_NOT_ACCEPTED';
  }
  if (parseAmount(original.amount) !== request.amountCents) {
    return 'AMOUNT_MISMATCH';
  }
  if (acceptedReversalOfOriginal !== undefined) {
    return 'ALREADY_REVERSED';
  }
  return undefined;
}

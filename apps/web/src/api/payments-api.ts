import type { AccountView, TransferPage, TransferView } from '../domain/types';
import type { HttpClient } from './http-client';

export interface CreateTransferInput {
  payload: string;
  idempotencyKey: string;
}

export interface PaymentsApi {
  listAccounts(): Promise<AccountView[]>;
  listTransfers(cursor?: string): Promise<TransferPage>;
  getTransfer(id: string): Promise<TransferView>;
  createTransfer(input: CreateTransferInput): Promise<TransferView>;
  reverseTransfer(id: string, idempotencyKey: string): Promise<void>;
}

export function createPaymentsApi(client: HttpClient): PaymentsApi {
  return {
    listAccounts() {
      return client.request<AccountView[]>({
        method: 'GET',
        base: '/api/payments',
        path: '/accounts',
        authenticated: true,
      });
    },
    listTransfers(cursor) {
      return client.request<TransferPage>({
        method: 'GET',
        base: '/api/payments',
        path: '/transfers',
        query: { cursor },
        authenticated: true,
      });
    },
    getTransfer(id) {
      return client.request<TransferView>({
        method: 'GET',
        base: '/api/payments',
        path: `/transfers/${encodeURIComponent(id)}`,
        authenticated: true,
      });
    },
    createTransfer(input) {
      // Idempotency-Key is reused for the same payload so a retry cannot debit twice.
      return client.request<TransferView>({
        method: 'POST',
        base: '/api/payments',
        path: '/transfers',
        body: JSON.parse(input.payload) as unknown,
        authenticated: true,
        idempotencyKey: input.idempotencyKey,
      });
    },
    reverseTransfer(id, idempotencyKey) {
      // A reversal is a monetary side effect: the same key replays the stored result.
      return client.request<void>({
        method: 'POST',
        base: '/api/payments',
        path: `/transfers/${encodeURIComponent(id)}/reversals`,
        body: {},
        authenticated: true,
        idempotencyKey,
      });
    },
  };
}

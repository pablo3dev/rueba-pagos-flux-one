import { QueryClient } from '@tanstack/react-query';
import { createAuditApi, type AuditApi } from '../api/audit-api';
import { createAuthApi, type AuthApi } from '../api/auth-api';
import { createHttpClient } from '../api/http-client';
import { createPaymentsApi, type PaymentsApi } from '../api/payments-api';
import { createSessionStore, type SessionStore } from '../session/session-store';

export interface AppServices {
  session: SessionStore;
  auth: AuthApi;
  payments: PaymentsApi;
  audit: AuditApi;
  queryClient: QueryClient;
}

export function createAppServices(): AppServices {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const session = createSessionStore({ onCleared: () => queryClient.clear() });
  const client = createHttpClient(session);
  return {
    session,
    auth: createAuthApi(client, session),
    payments: createPaymentsApi(client),
    audit: createAuditApi(client),
    queryClient,
  };
}

import type { AuthUser, Credentials, RegisterResult, SessionPayload } from '../domain/types';
import type { SessionStore } from '../session/session-store';
import { errorMessage, isApiError } from './api-error';
import type { HttpClient } from './http-client';

export interface AuthApi {
  restoreSession(): Promise<void>;
  register(credentials: Credentials): Promise<RegisterResult>;
  login(credentials: Credentials): Promise<void>;
  logout(): Promise<void>;
  getProfile(): Promise<AuthUser>;
}

export function createAuthApi(client: HttpClient, session: SessionStore): AuthApi {
  let restoring: Promise<void> | null = null;

  return {
    restoreSession() {
      restoring ??= client.refreshSession().then(
        () => undefined,
        (error: unknown) => {
          if (session.getSnapshot().status === 'anonymous') return;
          if (isApiError(error) && error.code === 'REFRESH_TOKEN_REUSED') return;
          session.clearSession({ loginNotice: errorMessage(error) });
        },
      );
      return restoring;
    },
    async register(credentials) {
      return client.request<RegisterResult>({
        method: 'POST',
        base: '/api/auth',
        path: '/auth/register',
        body: { email: credentials.email.trim(), password: credentials.password },
        authenticated: false,
      });
    },
    async login(credentials) {
      const payload = await client.request<SessionPayload>({
        method: 'POST',
        base: '/api/auth',
        path: '/auth/login',
        body: { email: credentials.email.trim(), password: credentials.password },
        authenticated: false,
      });
      session.setSession(payload.accessToken, payload.user);
    },
    async logout() {
      try {
        await client.request<void>({
          method: 'POST',
          base: '/api/auth',
          path: '/auth/logout',
          authenticated: false,
        });
      } catch {
        // Local session closes even when the server is unreachable.
      }
      session.clearSession();
    },
    getProfile() {
      return client.request<AuthUser>({
        method: 'GET',
        base: '/api/auth',
        path: '/auth/me',
        authenticated: true,
      });
    },
  };
}

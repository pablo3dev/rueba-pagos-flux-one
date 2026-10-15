import type { AuthUser } from '../domain/types';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionSnapshot {
  status: SessionStatus;
  user: AuthUser | null;
  loginNotice: string | null;
}

export interface SessionStore {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  getAccessToken(): string | null;
  setSession(accessToken: string, user: AuthUser): void;
  clearSession(options?: { loginNotice?: string }): void;
  setLoginNotice(notice: string | null): void;
}

export function createSessionStore(options: { onCleared: () => void }): SessionStore {
  let accessToken: string | null = null;
  let snapshot: SessionSnapshot = { status: 'loading', user: null, loginNotice: null };
  const listeners = new Set<() => void>();

  const publish = (next: SessionSnapshot): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getAccessToken: () => accessToken,
    setSession(token, user) {
      accessToken = token;
      publish({ status: 'authenticated', user, loginNotice: null });
    },
    clearSession(clearOptions) {
      accessToken = null;
      options.onCleared();
      publish({
        status: 'anonymous',
        user: null,
        loginNotice: clearOptions?.loginNotice ?? null,
      });
    },
    setLoginNotice(notice) {
      publish({ ...snapshot, loginNotice: notice });
    },
  };
}

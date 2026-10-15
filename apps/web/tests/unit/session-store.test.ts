import { describe, expect, it, vi } from 'vitest';
import { createSessionStore } from '../../src/session/session-store';

describe('session store', () => {
  it('keeps the access token out of the snapshot and clears it once', () => {
    const onCleared = vi.fn();
    const session = createSessionStore({ onCleared });
    session.setSession('secret-token', { id: '1', email: 'alice@fluxone.test' });
    expect(session.getAccessToken()).toBe('secret-token');
    expect(JSON.stringify(session.getSnapshot())).not.toContain('secret-token');
    session.clearSession();
    session.clearSession();
    expect(session.getAccessToken()).toBeNull();
    expect(session.getSnapshot().status).toBe('anonymous');
    expect(onCleared).toHaveBeenCalledTimes(2);
  });
});

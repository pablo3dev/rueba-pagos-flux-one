import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '../../src/api/http-client';
import { createSessionStore } from '../../src/session/session-store';

function json(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('http client', () => {
  it('does not refresh when a public login returns 401', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (input: string) => {
      urls.push(String(input));
      return json(401, {
        error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' },
      });
    });
    const client = createHttpClient(createSessionStore({ onCleared: () => undefined }));
    await expect(
      client.request({
        method: 'POST',
        base: '/api/auth',
        path: '/auth/login',
        body: { email: 'a@b.co', password: 'x' },
        authenticated: false,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(urls).toEqual(['/api/auth/auth/login']);
  });

  it('refreshes once and retries an authenticated request with the new bearer token', async () => {
    const calls: { url: string; authorization: string | null; key: string | null }[] = [];
    let ready = false;
    vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        authorization: headers.get('Authorization'),
        key: headers.get('Idempotency-Key'),
      });
      if (String(input).endsWith('/auth/refresh')) {
        ready = true;
        return json(200, {
          accessToken: 'next-token',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: { id: '1', email: 'alice@fluxone.test' },
        });
      }
      if (!ready) {
        return json(401, {
          error: { code: 'UNAUTHORIZED', message: 'Token de acceso ausente o inválido.' },
        });
      }
      return json(200, { id: 'transfer-1' });
    });
    const session = createSessionStore({ onCleared: () => undefined });
    session.setSession('old-token', { id: '1', email: 'alice@fluxone.test' });
    const client = createHttpClient(session);
    const body = await client.request<{ id: string }>({
      method: 'POST',
      base: '/api/payments',
      path: '/transfers',
      body: { type: 'INTERNAL' },
      authenticated: true,
      idempotencyKey: 'key-1',
    });
    expect(body.id).toBe('transfer-1');
    expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(calls.filter((call) => call.url.endsWith('/transfers')).map((call) => call.key)).toEqual(
      ['key-1', 'key-1'],
    );
    expect(calls.at(-1)?.authorization).toBe('Bearer next-token');
  });

  it('shares one refresh across concurrent 401 responses', async () => {
    let refreshCount = 0;
    let ready = false;
    vi.stubGlobal('fetch', async (input: string) => {
      if (String(input).endsWith('/auth/refresh')) {
        refreshCount += 1;
        ready = true;
        return json(200, {
          accessToken: 'shared',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: { id: '1', email: 'alice@fluxone.test' },
        });
      }
      if (!ready) {
        return json(401, {
          error: { code: 'UNAUTHORIZED', message: 'Token de acceso ausente o inválido.' },
        });
      }
      return json(200, { ok: true });
    });
    const session = createSessionStore({ onCleared: () => undefined });
    session.setSession('old', { id: '1', email: 'alice@fluxone.test' });
    const client = createHttpClient(session);
    await Promise.all(
      [1, 2, 3].map(() =>
        client.request({
          method: 'GET',
          base: '/api/payments',
          path: '/accounts',
          authenticated: true,
        }),
      ),
    );
    expect(refreshCount).toBe(1);
  });

  it('closes the session when a refresh token was reused', async () => {
    vi.stubGlobal('fetch', async () =>
      json(401, {
        error: {
          code: 'REFRESH_TOKEN_REUSED',
          message: 'La sesión fue revocada por seguridad. Inicia sesión de nuevo.',
        },
      }),
    );
    const session = createSessionStore({ onCleared: () => undefined });
    session.setSession('old', { id: '1', email: 'alice@fluxone.test' });
    const client = createHttpClient(session);
    await expect(client.refreshSession()).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });
    expect(session.getAccessToken()).toBeNull();
    expect(session.getSnapshot().loginNotice).toContain('revocada');
  });

  it('maps a network failure and a non-json gateway error', async () => {
    const session = createSessionStore({ onCleared: () => undefined });
    const client = createHttpClient(session);
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    await expect(
      client.request({
        method: 'GET',
        base: '/api/payments',
        path: '/accounts',
        authenticated: true,
      }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    vi.stubGlobal('fetch', async () => new Response('<html>bad</html>', { status: 502 }));
    await expect(
      client.request({
        method: 'GET',
        base: '/api/payments',
        path: '/accounts',
        authenticated: true,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'El servicio no está disponible. Intenta de nuevo más tarde.',
    });
  });
});

import type { SessionPayload } from '../domain/types';
import type { SessionStore } from '../session/session-store';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  readServiceError,
} from './api-error';

export type ApiBase = '/api/auth' | '/api/payments' | '/api/audit';

export interface RequestOptions {
  method: 'GET' | 'POST';
  base: ApiBase;
  path: string;
  body?: unknown;
  authenticated: boolean;
  idempotencyKey?: string;
  query?: Record<string, string | undefined>;
}

export interface HttpClient {
  request<T>(options: RequestOptions): Promise<T>;
  refreshSession(): Promise<void>;
}

const PUBLIC_AUTH = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);

export function createHttpClient(session: SessionStore): HttpClient {
  let inFlight: Promise<void> | null = null;

  const send = async (options: RequestOptions): Promise<Response> => {
    const headers = new Headers({ Accept: 'application/json' });
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (options.authenticated) {
      const token = session.getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) params.set(key, value);
    }
    const query = params.size > 0 ? `?${params.toString()}` : '';
    try {
      return await fetch(`${options.base}${options.path}${query}`, {
        method: options.method,
        credentials: 'same-origin',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
    }
  };

  const parse = async <T>(response: Response): Promise<T> => {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (response.ok) {
      if (text.trim() === '') return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError(response.status, 'SERVICE_UNAVAILABLE', SERVICE_UNAVAILABLE_MESSAGE);
      }
    }
    let body: unknown = null;
    if (text.trim() !== '') {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    const serviceError = readServiceError(body);
    if (serviceError) throw new ApiError(response.status, serviceError.code, serviceError.message);
    throw new ApiError(response.status, 'SERVICE_UNAVAILABLE', SERVICE_UNAVAILABLE_MESSAGE);
  };

  const performRefresh = async (): Promise<void> => {
    const response = await send({
      method: 'POST',
      base: '/api/auth',
      path: '/auth/refresh',
      authenticated: false,
    });
    if (response.status === 401) {
      const error = await parse<never>(response).catch((caught: unknown) => caught);
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(401, 'REFRESH_TOKEN_INVALID', 'La sesión no es válida o expiró.');
      session.clearSession(
        apiError.code === 'REFRESH_TOKEN_REUSED' ? { loginNotice: apiError.message } : undefined,
      );
      throw apiError;
    }
    const payload = await parse<SessionPayload>(response);
    session.setSession(payload.accessToken, payload.user);
  };

  const refreshSession = (): Promise<void> => {
    if (!inFlight) {
      inFlight = performRefresh().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };

  const request = async <T>(options: RequestOptions): Promise<T> => {
    const first = await send(options);
    const isPublicAuth = options.base === '/api/auth' && PUBLIC_AUTH.has(options.path);
    if (first.status !== 401 || !options.authenticated || isPublicAuth) return parse<T>(first);
    await refreshSession();
    const retry = await send(options);
    if (retry.status === 401) {
      session.clearSession();
      return parse<T>(retry);
    }
    return parse<T>(retry);
  };

  return { request, refreshSession };
}

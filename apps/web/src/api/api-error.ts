export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Intenta de nuevo.';
export const SERVICE_UNAVAILABLE_MESSAGE =
  'El servicio no está disponible. Intenta de nuevo más tarde.';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  return SERVICE_UNAVAILABLE_MESSAGE;
}

export function readServiceError(body: unknown): { code: string; message: string } | null {
  if (!body || typeof body !== 'object') return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  if (typeof code !== 'string' || typeof message !== 'string' || message.trim() === '') return null;
  return { code, message };
}

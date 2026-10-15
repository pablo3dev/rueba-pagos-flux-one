// adapter: out — HTTP (riel bancario, vencimiento 10 s, sin transacción de base de datos)
import { formatMoney } from '../../../domain/money.js';
import type { RailOutcome } from '../../../domain/transfer.js';
import type { Logger } from '../../../application/ports/logger.js';
import type {
  BankRailPort,
  RailQueryInput,
  RailReversalInput,
  RailSubmitInput,
} from '../../../application/ports/bank-rail-port.js';

export const RAIL_TIMEOUT_MS = 10_000;

export class HttpBankRail implements BankRailPort {
  constructor(
    private readonly options: { baseUrl: string; logger: Logger; timeoutMs?: number },
  ) {}

  async submit(input: RailSubmitInput): Promise<Exclude<RailOutcome, 'NOT_FOUND'>> {
    const outcome = await this.call('SUBMIT', `${this.base()}/rail/transfers`, {
      method: 'POST',
      body: JSON.stringify({
        reference: input.reference,
        from: input.from,
        to: input.to,
        amount: formatMoney(input.amount),
      }),
      correlationId: input.correlationId,
      reference: input.reference,
    });
    return outcome === 'NOT_FOUND' ? 'NETWORK_ERROR' : outcome;
  }

  async submitReversal(input: RailReversalInput): Promise<Exclude<RailOutcome, 'NOT_FOUND'>> {
    const outcome = await this.call('SUBMIT', `${this.base()}/rail/reversals`, {
      method: 'POST',
      body: JSON.stringify({
        reference: input.reference,
        originalReference: input.originalReference,
        amount: formatMoney(input.amount),
      }),
      correlationId: input.correlationId,
      reference: input.reference,
    });
    return outcome === 'NOT_FOUND' ? 'NETWORK_ERROR' : outcome;
  }

  async query(input: RailQueryInput): Promise<RailOutcome> {
    const url = `${this.base()}/rail/transfers/${encodeURIComponent(input.reference)}`;
    return this.call('QUERY', url, {
      method: 'GET',
      correlationId: input.correlationId,
      reference: input.reference,
    });
  }

  private base(): string {
    return this.options.baseUrl.replace(/\/+$/, '');
  }

  private async call(
    operation: 'SUBMIT' | 'QUERY',
    url: string,
    request: { method: 'GET' | 'POST'; body?: string; correlationId: string | null; reference: string },
  ): Promise<RailOutcome> {
    const timeoutMs = this.options.timeoutMs ?? RAIL_TIMEOUT_MS;
    const headers: Record<string, string> = {};
    if (request.body) headers['content-type'] = 'application/json';
    if (request.correlationId) headers['x-request-id'] = request.correlationId;
    const started = Date.now();
    this.options.logger.info(
      { event: 'rail.request', operation, transferId: request.reference, correlationId: request.correlationId },
      'llamada al riel',
    );
    try {
      const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.body,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
      const body = await readBody(response);
      const outcome = translate(operation, response.status, body, request.reference);
      this.options.logger.info(
        {
          event: 'rail.response',
          operation,
          transferId: request.reference,
          correlationId: request.correlationId,
          outcome,
          httpStatus: response.status,
          errorCode: null,
          durationMs: Date.now() - started,
        },
        'respuesta del riel',
      );
      return outcome;
    } catch (error) {
      const outcome = classifyThrown(error);
      if (outcome === 'TIMEOUT') {
        this.options.logger.warn(
          {
            event: 'rail.timeout',
            operation,
            transferId: request.reference,
            correlationId: request.correlationId,
            timeoutMs,
          },
          'vencimiento del riel',
        );
      } else {
        this.options.logger.info(
          {
            event: 'rail.response',
            operation,
            transferId: request.reference,
            correlationId: request.correlationId,
            outcome,
            httpStatus: null,
            errorCode: errorCode(error),
            durationMs: Date.now() - started,
          },
          'fallo del riel',
        );
      }
      return outcome;
    }
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function translate(
  operation: 'SUBMIT' | 'QUERY',
  status: number,
  body: unknown,
  reference: string,
): RailOutcome {
  if (status === 200 && isAccepted(body, reference)) return 'ACCEPTED';
  if (status === 422 && hasErrorCode(body, 'REJECTED')) return 'REJECTED';
  if (status === 404 && hasErrorCode(body, 'NOT_FOUND')) {
    return operation === 'QUERY' ? 'NOT_FOUND' : 'NETWORK_ERROR';
  }
  if (status === 503) return 'UNAVAILABLE';
  return 'NETWORK_ERROR';
}

function isAccepted(body: unknown, reference: string): boolean {
  if (!body || typeof body !== 'object') return false;
  const record = body as { reference?: unknown; status?: unknown };
  return record.reference === reference && record.status === 'ACCEPTED';
}

function hasErrorCode(body: unknown, code: string): boolean {
  if (!body || typeof body !== 'object') return false;
  const error = (body as { error?: { code?: unknown } }).error;
  return error?.code === code;
}

function classifyThrown(error: unknown): Exclude<RailOutcome, 'NOT_FOUND' | 'ACCEPTED' | 'REJECTED'> {
  if (isTimeout(error)) return 'TIMEOUT';
  const code = errorCode(error);
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'UNAVAILABLE';
  return 'NETWORK_ERROR';
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  if (name === 'TimeoutError') return true;
  const cause = (error as { cause?: { name?: string } }).cause;
  return cause?.name === 'TimeoutError';
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const direct = (error as { code?: string }).code;
  if (direct) return direct;
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code ?? null;
}

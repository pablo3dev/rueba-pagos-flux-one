// adapter: out — archivo JSONL
import { appendFile, mkdir, readFile, truncate } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Ledger } from '../../../application/ports/ledger.js';
import { LedgerUnavailableError } from '../../../domain/errors.js';
import { parseStoredOperation, type BankOperation } from '../../../domain/operation.js';

const LINE_KEYS = [
  'reference',
  'kind',
  'from',
  'to',
  'originalReference',
  'amount',
  'status',
  'reason',
  'recordedAt',
] as const satisfies readonly (keyof BankOperation)[];

export interface LedgerLoadWarning {
  event: 'rail.ledger_truncated_line_discarded';
  line: number;
  bytes: number;
}

export class JsonlFileLedger implements Ledger {
  static async open(filePath: string): Promise<JsonlFileLedger> {
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, '', 'utf8');
    const loaded = await loadLedger(filePath);
    return new JsonlFileLedger(
      filePath,
      loaded.byReference,
      loaded.acceptedReversals,
      loaded.needsLeadingNewline,
      loaded.loadWarnings,
    );
  }

  private tail: Promise<void> = Promise.resolve();

  private constructor(
    private readonly filePath: string,
    private readonly byReference: Map<string, BankOperation>,
    private readonly acceptedReversals: Map<string, BankOperation>,
    private needsLeadingNewline: boolean,
    readonly loadWarnings: readonly LedgerLoadWarning[],
  ) {}

  find(reference: string): Promise<BankOperation | undefined> {
    return Promise.resolve(this.byReference.get(reference));
  }

  findAcceptedReversalOf(originalReference: string): Promise<BankOperation | undefined> {
    return Promise.resolve(this.acceptedReversals.get(originalReference));
  }

  // Efecto de lado: anexa una línea. No es idempotente: OperationFlow consulta la referencia
  // en la sección serializada; si ya existe, esto es un error de programación y no reescribe.
  append(operation: BankOperation): Promise<void> {
    const result = this.tail.then(() => this.writeOperation(operation));
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async writeOperation(operation: BankOperation): Promise<void> {
    if (this.byReference.has(operation.reference)) {
      throw new Error('La referencia ya existe en el libro.');
    }
    const prefix = this.needsLeadingNewline ? '\n' : '';
    try {
      await appendFile(this.filePath, `${prefix}${serializeOperation(operation)}\n`, 'utf8');
    } catch (cause) {
      throw new LedgerUnavailableError('No se pudo escribir la operación en el libro.', { cause });
    }
    this.needsLeadingNewline = false;
    remember(this.byReference, this.acceptedReversals, operation);
  }
}

interface LoadedLedger {
  byReference: Map<string, BankOperation>;
  acceptedReversals: Map<string, BankOperation>;
  needsLeadingNewline: boolean;
  loadWarnings: readonly LedgerLoadWarning[];
}

async function loadLedger(filePath: string): Promise<LoadedLedger> {
  const content = await readFile(filePath, 'utf8');
  const endsWithNewline = content.length === 0 || content.endsWith('\n');
  const physical = content.length === 0 ? [] : content.split('\n');
  if (endsWithNewline && physical.length > 0) {
    physical.pop();
  }

  let limit = physical.length;
  let truncated: LedgerLoadWarning | undefined;
  if (!endsWithNewline && physical.length > 0) {
    const last = physical[physical.length - 1] ?? '';
    if (last.trim() !== '' && !isJson(last)) {
      limit = physical.length - 1;
      truncated = {
        event: 'rail.ledger_truncated_line_discarded',
        line: physical.length,
        bytes: Buffer.byteLength(last, 'utf8'),
      };
    }
  }

  const byReference = new Map<string, BankOperation>();
  const acceptedReversals = new Map<string, BankOperation>();
  for (let index = 0; index < limit; index += 1) {
    const line = physical[index] ?? '';
    if (line.trim() === '') {
      continue;
    }
    remember(byReference, acceptedReversals, parseLine(filePath, index + 1, line, byReference));
  }

  if (truncated !== undefined) {
    const lastNl = content.lastIndexOf('\n');
    const kept = lastNl === -1 ? '' : content.slice(0, lastNl + 1);
    await truncate(filePath, Buffer.byteLength(kept, 'utf8'));
  }

  return {
    byReference,
    acceptedReversals,
    needsLeadingNewline: content.length > 0 && !endsWithNewline && truncated === undefined,
    loadWarnings: truncated === undefined ? [] : [truncated],
  };
}

function isJson(line: string): boolean {
  try {
    JSON.parse(line);
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }
    throw error;
  }
}

function parseLine(
  filePath: string,
  lineNumber: number,
  line: string,
  byReference: Map<string, BankOperation>,
): BankOperation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw corruptLine(filePath, lineNumber, 'JSON inválido');
    }
    throw error;
  }
  let operation: BankOperation;
  try {
    operation = parseStoredOperation(parsed);
  } catch (error) {
    throw corruptLine(filePath, lineNumber, errorDetail(error));
  }
  if (byReference.has(operation.reference)) {
    throw corruptLine(filePath, lineNumber, 'referencia repetida');
  }
  return operation;
}

function remember(
  byReference: Map<string, BankOperation>,
  acceptedReversals: Map<string, BankOperation>,
  operation: BankOperation,
): void {
  byReference.set(operation.reference, operation);
  if (
    operation.kind === 'REVERSAL' &&
    operation.status === 'ACCEPTED' &&
    operation.originalReference !== undefined
  ) {
    acceptedReversals.set(operation.originalReference, operation);
  }
}

function serializeOperation(operation: BankOperation): string {
  const ordered: Record<string, string> = {};
  for (const key of LINE_KEYS) {
    const value = operation[key];
    if (value !== undefined) {
      ordered[key] = value;
    }
  }
  return JSON.stringify(ordered);
}

function corruptLine(filePath: string, lineNumber: number, detail: string): Error {
  return new Error(`Ledger corrupto en ${filePath}: línea ${lineNumber} inválida (${detail})`);
}

function errorDetail(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'operación inválida';
}

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonlFileLedger } from '../../../src/adapters/outbound/ledger/jsonl-file-ledger.js';
import { LedgerUnavailableError } from '../../../src/domain/errors.js';
import type { BankOperation } from '../../../src/domain/operation.js';

const ACCEPTED_TRANSFER_LINE =
  '{"reference":"TRX-0001","kind":"TRANSFER","from":"ACC-001","to":"EXT-0001","amount":"1500.50","status":"ACCEPTED","recordedAt":"2026-10-15T14:00:00.000Z"}';
const REJECTED_TRANSFER_LINE =
  '{"reference":"TRX-0002","kind":"TRANSFER","from":"ACC-002","to":"EXT-0002","amount":"20.00","status":"REJECTED","reason":"REJECTED_BY_BANK","recordedAt":"2026-10-15T14:00:05.000Z"}';
const ACCEPTED_REVERSAL_LINE =
  '{"reference":"REV-0001","kind":"REVERSAL","originalReference":"TRX-0001","amount":"1500.50","status":"ACCEPTED","recordedAt":"2026-10-15T14:01:00.000Z"}';
const REJECTED_REVERSAL_LINE =
  '{"reference":"REV-0002","kind":"REVERSAL","originalReference":"TRX-0002","amount":"20.00","status":"REJECTED","reason":"ORIGINAL_NOT_ACCEPTED","recordedAt":"2026-10-15T14:01:10.000Z"}';

const dirs: string[] = [];

afterEach(async () => {
  const created = dirs.splice(0);
  await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('JsonlFileLedger', () => {
  it('[AC-RIE-26] open crea directorio y archivo y arranca vacío', async () => {
    const dir = await tempDir();
    const filePath = join(dir, 'nested', 'rail-ledger.jsonl');

    const ledger = await JsonlFileLedger.open(filePath);

    expect((await stat(join(dir, 'nested'))).isDirectory()).toBe(true);
    const file = await stat(filePath);
    expect(file.isFile()).toBe(true);
    expect(file.size).toBe(0);
    expect(await readFile(filePath, 'utf8')).toBe('');
    expect(ledger.loadWarnings).toEqual([]);
    expect(await ledger.find('TRX-0001')).toBeUndefined();
    expect(await ledger.findAcceptedReversalOf('TRX-0001')).toBeUndefined();
  });

  it('[AC-RIE-24] cada append deja exactamente una línea JSON terminada en \\n con las claves en el orden de § 3.2, y append resuelve solo después de escribir', async () => {
    const filePath = join(await tempDir(), 'ledger.jsonl');
    const ledger = await JsonlFileLedger.open(filePath);
    const rows: Array<[BankOperation, string]> = [
      [shuffledAcceptedTransfer(), ACCEPTED_TRANSFER_LINE],
      [shuffledRejectedTransfer(), REJECTED_TRANSFER_LINE],
      [shuffledAcceptedReversal(), ACCEPTED_REVERSAL_LINE],
      [shuffledRejectedReversal(), REJECTED_REVERSAL_LINE],
    ];
    let expected = '';

    for (const [operation, line] of rows) {
      const writtenAtResolution = ledger.append(operation).then(() => readFile(filePath, 'utf8'));
      expected += `${line}\n`;
      await expect(writtenAtResolution).resolves.toBe(expected);
    }

    let duplicate: unknown;
    try {
      await ledger.append(shuffledAcceptedTransfer());
    } catch (error) {
      duplicate = error;
    }
    expect(duplicate).toBeInstanceOf(Error);
    expect(duplicate).not.toBeInstanceOf(LedgerUnavailableError);
    expect(await readFile(filePath, 'utf8')).toBe(expected);

    const later = acceptedTransfer();
    later.reference = 'TRX-0003';
    later.recordedAt = '2026-10-15T14:02:00.000Z';
    await expect(ledger.append(later)).resolves.toBeUndefined();
    expect(await ledger.find('TRX-0003')).toEqual(later);
  });

  it('[AC-RIE-25] tras append y reabrir, find y findAcceptedReversalOf devuelven las mismas operaciones', async () => {
    const filePath = join(await tempDir(), 'ledger.jsonl');
    const operations = [
      acceptedTransfer(),
      rejectedTransfer(),
      acceptedReversal(),
      rejectedReversal(),
    ];
    const ledger = await JsonlFileLedger.open(filePath);
    for (const operation of operations) {
      await ledger.append(operation);
    }

    const reopened = await JsonlFileLedger.open(filePath);

    expect(await reopened.find('TRX-0001')).toEqual(acceptedTransfer());
    expect(await reopened.find('TRX-0002')).toEqual(rejectedTransfer());
    expect(await reopened.find('REV-0001')).toEqual(acceptedReversal());
    expect(await reopened.find('REV-0002')).toEqual(rejectedReversal());
    expect(await reopened.findAcceptedReversalOf('TRX-0001')).toEqual(acceptedReversal());
    expect(await reopened.findAcceptedReversalOf('TRX-0002')).toBeUndefined();
    expect(await reopened.find('AUSENTE')).toBeUndefined();
  });

  it('[AC-RIE-27] línea final sin \\n que no es JSON se ignora, el archivo queda truncado hasta el último \\n y loadWarnings trae rail.ledger_truncated_line_discarded; una última línea válida sin \\n se acepta', async () => {
    const dir = await tempDir();
    const truncatedPath = join(dir, 'truncated.jsonl');
    const fragment = 'xá';
    await writeFile(truncatedPath, `${ACCEPTED_TRANSFER_LINE}\n${fragment}`, 'utf8');

    const truncated = await JsonlFileLedger.open(truncatedPath);

    expect(await readFile(truncatedPath, 'utf8')).toBe(`${ACCEPTED_TRANSFER_LINE}\n`);
    expect(truncated.loadWarnings).toEqual([
      {
        event: 'rail.ledger_truncated_line_discarded',
        line: 2,
        bytes: Buffer.byteLength(fragment, 'utf8'),
      },
    ]);
    expect(await truncated.find('TRX-0001')).toEqual(acceptedTransfer());

    const onlyFragmentPath = join(dir, 'only-fragment.jsonl');
    await writeFile(onlyFragmentPath, fragment, 'utf8');
    const emptied = await JsonlFileLedger.open(onlyFragmentPath);
    expect(await readFile(onlyFragmentPath, 'utf8')).toBe('');
    expect(emptied.loadWarnings).toEqual([
      {
        event: 'rail.ledger_truncated_line_discarded',
        line: 1,
        bytes: Buffer.byteLength(fragment, 'utf8'),
      },
    ]);
    expect(await emptied.find('TRX-0001')).toBeUndefined();

    const validPath = join(dir, 'valid-tail.jsonl');
    await writeFile(validPath, ACCEPTED_TRANSFER_LINE, 'utf8');
    const valid = await JsonlFileLedger.open(validPath);
    expect(valid.loadWarnings).toEqual([]);
    expect(await valid.find('TRX-0001')).toEqual(acceptedTransfer());
    expect(await readFile(validPath, 'utf8')).toBe(ACCEPTED_TRANSFER_LINE);

    const writtenAtResolution = valid
      .append(rejectedTransfer())
      .then(() => readFile(validPath, 'utf8'));
    await expect(writtenAtResolution).resolves.toBe(
      `${ACCEPTED_TRANSFER_LINE}\n${REJECTED_TRANSFER_LINE}\n`,
    );
  });

  it('[AC-RIE-28] línea intermedia corrupta o referencia repetida: open rechaza con mensaje que indica el número de línea y el archivo no cambia', async () => {
    const dir = await tempDir();
    const corruptPath = join(dir, 'corrupt.jsonl');
    const corrupt = `${ACCEPTED_TRANSFER_LINE}\nnot-json\ntruncated-tail`;
    await writeFile(corruptPath, corrupt, 'utf8');

    await expectOpenUnchanged(
      corruptPath,
      corrupt,
      `Ledger corrupto en ${corruptPath}: línea 2 inválida (JSON inválido)`,
    );

    const duplicatePath = join(dir, 'duplicate.jsonl');
    const duplicate = `${ACCEPTED_TRANSFER_LINE}\n${ACCEPTED_TRANSFER_LINE}\n`;
    await writeFile(duplicatePath, duplicate, 'utf8');

    await expectOpenUnchanged(
      duplicatePath,
      duplicate,
      `Ledger corrupto en ${duplicatePath}: línea 2 inválida (referencia repetida)`,
    );
  });

  it('[AC-RIE-29] archivo reemplazado por un directorio: append lanza LedgerUnavailableError, la operación no queda visible y un append posterior sigue operativo; escrituras concurrentes producen líneas íntegras', async () => {
    const dir = await tempDir();
    const filePath = join(dir, 'ledger.jsonl');
    const ledger = await JsonlFileLedger.open(filePath);
    const kept = acceptedTransfer();
    await ledger.append(kept);
    await rm(filePath);
    await mkdir(filePath);

    const hidden = acceptedTransfer();
    hidden.reference = 'TRX-FAIL';
    let caught: unknown;
    try {
      await ledger.append(hidden);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LedgerUnavailableError);
    expect((caught as LedgerUnavailableError).cause).toBeInstanceOf(Error);
    expect(await ledger.find('TRX-FAIL')).toBeUndefined();
    expect(await ledger.find('TRX-0001')).toEqual(kept);

    await rm(filePath, { recursive: true, force: true });
    const next = acceptedTransfer();
    next.reference = 'TRX-NEXT';
    await expect(ledger.append(next)).resolves.toBeUndefined();
    expect(await ledger.find('TRX-NEXT')).toEqual(next);
    expect(await ledger.find('TRX-FAIL')).toBeUndefined();
    const restored = await readFile(filePath, 'utf8');
    expect(restored.endsWith('\n')).toBe(true);
    expect(restored).not.toContain('TRX-FAIL');
    expect((JSON.parse(restored.trim()) as { reference: string }).reference).toBe('TRX-NEXT');

    const concurrentPath = join(dir, 'concurrent.jsonl');
    const concurrent = await JsonlFileLedger.open(concurrentPath);
    const ops = ['A', 'B', 'C', 'D', 'E'].map((suffix) => {
      const operation = acceptedTransfer();
      operation.reference = `TRX-${suffix}`;
      return operation;
    });
    await Promise.all(ops.map((operation) => concurrent.append(operation)));
    const text = await readFile(concurrentPath, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    const lines = text.split('\n').slice(0, -1);
    expect(lines).toHaveLength(ops.length);
    expect(lines.map((line) => (JSON.parse(line) as { reference: string }).reference)).toEqual(
      ops.map((operation) => operation.reference),
    );
  });
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'bank-rail-ledger-'));
  dirs.push(dir);
  return dir;
}

async function expectOpenUnchanged(
  filePath: string,
  original: string,
  message: string,
): Promise<void> {
  await expect(JsonlFileLedger.open(filePath)).rejects.toThrow(new Error(message));
  expect(await readFile(filePath, 'utf8')).toBe(original);
}

function acceptedTransfer(): BankOperation {
  return {
    reference: 'TRX-0001',
    kind: 'TRANSFER',
    from: 'ACC-001',
    to: 'EXT-0001',
    amount: '1500.50',
    status: 'ACCEPTED',
    recordedAt: '2026-10-15T14:00:00.000Z',
  };
}

function rejectedTransfer(): BankOperation {
  return {
    reference: 'TRX-0002',
    kind: 'TRANSFER',
    from: 'ACC-002',
    to: 'EXT-0002',
    amount: '20.00',
    status: 'REJECTED',
    reason: 'REJECTED_BY_BANK',
    recordedAt: '2026-10-15T14:00:05.000Z',
  };
}

function acceptedReversal(): BankOperation {
  return {
    reference: 'REV-0001',
    kind: 'REVERSAL',
    originalReference: 'TRX-0001',
    amount: '1500.50',
    status: 'ACCEPTED',
    recordedAt: '2026-10-15T14:01:00.000Z',
  };
}

function rejectedReversal(): BankOperation {
  return {
    reference: 'REV-0002',
    kind: 'REVERSAL',
    originalReference: 'TRX-0002',
    amount: '20.00',
    status: 'REJECTED',
    reason: 'ORIGINAL_NOT_ACCEPTED',
    recordedAt: '2026-10-15T14:01:10.000Z',
  };
}

function shuffledAcceptedTransfer(): BankOperation {
  return {
    recordedAt: '2026-10-15T14:00:00.000Z',
    status: 'ACCEPTED',
    amount: '1500.50',
    to: 'EXT-0001',
    from: 'ACC-001',
    kind: 'TRANSFER',
    reference: 'TRX-0001',
  };
}

function shuffledRejectedTransfer(): BankOperation {
  return {
    reason: 'REJECTED_BY_BANK',
    recordedAt: '2026-10-15T14:00:05.000Z',
    status: 'REJECTED',
    amount: '20.00',
    to: 'EXT-0002',
    from: 'ACC-002',
    kind: 'TRANSFER',
    reference: 'TRX-0002',
  };
}

function shuffledAcceptedReversal(): BankOperation {
  return {
    recordedAt: '2026-10-15T14:01:00.000Z',
    status: 'ACCEPTED',
    amount: '1500.50',
    originalReference: 'TRX-0001',
    kind: 'REVERSAL',
    reference: 'REV-0001',
  };
}

function shuffledRejectedReversal(): BankOperation {
  return {
    recordedAt: '2026-10-15T14:01:10.000Z',
    reason: 'ORIGINAL_NOT_ACCEPTED',
    status: 'REJECTED',
    amount: '20.00',
    originalReference: 'TRX-0002',
    kind: 'REVERSAL',
    reference: 'REV-0002',
  };
}

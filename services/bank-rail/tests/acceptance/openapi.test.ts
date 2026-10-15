import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const openApiPath = join(dirname(fileURLToPath(import.meta.url)), '../../openapi.yaml');

describe('contrato OpenAPI', () => {
  it('[AC-RIE-39] openapi.yaml describe el contrato HTTP 3.1 sin seguridad', async () => {
    const source = await readFile(openApiPath, 'utf8');

    expect(source).toMatch(/openapi:\s*'?3\.1/);
    expect(source).toMatch(/\/rail\/transfers:/);
    expect(source).toMatch(/\/rail\/transfers\/\{reference\}:/);
    expect(source).toMatch(/\/rail\/reversals:/);
    expect(source).toMatch(/\/health:/);
    expect(source).toMatch(/post:/);
    expect(source).toMatch(/get:/);

    for (const name of ['TransferRequest', 'ReversalRequest', 'OperationStatus', 'ErrorResponse']) {
      expect(source).toContain(name);
    }

    for (const status of ['200', '400', '404', '409', '422', '500', '503']) {
      expect(source).toContain(status);
    }

    for (const code of [
      'VALIDATION_ERROR',
      'REFERENCE_CONFLICT',
      'REJECTED',
      'ORIGINAL_NOT_FOUND',
      'ORIGINAL_NOT_ACCEPTED',
      'AMOUNT_MISMATCH',
      'ALREADY_REVERSED',
      'NOT_FOUND',
      'UNAVAILABLE',
      'INTERNAL_ERROR',
    ]) {
      expect(source).toContain(code);
    }

    expect(source).not.toMatch(/security/i);
  });
});

export class ValidationError extends Error {
  name = 'ValidationError';
}

export class ReferenceConflictError extends Error {
  name = 'ReferenceConflictError';
}

export class LedgerUnavailableError extends Error {
  name = 'LedgerUnavailableError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

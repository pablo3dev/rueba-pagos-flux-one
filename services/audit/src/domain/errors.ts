export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends Error {
  constructor() {
    super('not found');
    this.name = 'NotFoundError';
  }
}

export class InvalidAuditEnvelopeError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidAuditEnvelopeError';
    this.reason = reason;
  }
}

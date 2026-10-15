// Errores de dominio. No conocen HTTP: el adaptador de entrada traduce el tipo.
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InvalidAmountError extends Error {
  constructor() {
    super('monto inválido');
    this.name = 'InvalidAmountError';
  }
}

export class IdempotencyKeyRequiredError extends Error {
  constructor() {
    super('Idempotency-Key requerida');
    this.name = 'IdempotencyKeyRequiredError';
  }
}

export class InsufficientFundsError extends Error {
  constructor() {
    super('fondos insuficientes');
    this.name = 'InsufficientFundsError';
  }
}

export class SameAccountError extends Error {
  constructor() {
    super('misma cuenta');
    this.name = 'SameAccountError';
  }
}

export class AccountNotFoundError extends Error {
  constructor() {
    super('cuenta no encontrada');
    this.name = 'AccountNotFoundError';
  }
}

export class DestinationNotFoundError extends Error {
  constructor() {
    super('destino no encontrado');
    this.name = 'DestinationNotFoundError';
  }
}

export class TransferNotFoundError extends Error {
  constructor() {
    super('transferencia no encontrada');
    this.name = 'TransferNotFoundError';
  }
}

export class IdempotencyKeyPayloadMismatchError extends Error {
  constructor() {
    super('payload distinto');
    this.name = 'IdempotencyKeyPayloadMismatchError';
  }
}

export class IdempotencyKeyInProgressError extends Error {
  constructor() {
    super('clave en curso');
    this.name = 'IdempotencyKeyInProgressError';
  }
}

export class AccessTokenInvalidError extends Error {
  constructor() {
    super('token inválido');
    this.name = 'AccessTokenInvalidError';
  }
}

export class InvalidTransferTransitionError extends Error {
  constructor() {
    super('transición inválida');
    this.name = 'InvalidTransferTransitionError';
  }
}

export class TransferNotReversibleError extends Error {
  constructor() {
    super('transferencia no reversible');
    this.name = 'TransferNotReversibleError';
  }
}

export class TransferAlreadyReversedError extends Error {
  constructor() {
    super('transferencia ya reversada');
    this.name = 'TransferAlreadyReversedError';
  }
}

export class ReversalInsufficientFundsError extends Error {
  constructor() {
    super('destino sin saldo para el reverso');
    this.name = 'ReversalInsufficientFundsError';
  }
}

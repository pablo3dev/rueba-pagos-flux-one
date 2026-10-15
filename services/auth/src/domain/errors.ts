export class ValidationError extends Error {
  name = 'ValidationError';
}

export class EmailAlreadyRegisteredError extends Error {
  name = 'EmailAlreadyRegisteredError';
}

export class InvalidCredentialsError extends Error {
  name = 'InvalidCredentialsError';
}

export class RefreshTokenInvalidError extends Error {
  name = 'RefreshTokenInvalidError';
}

export class RefreshTokenReusedError extends Error {
  name = 'RefreshTokenReusedError';

  constructor(
    readonly userId: string,
    readonly familyId: string,
  ) {
    super('refresh token reused');
  }
}

export class AccessTokenInvalidError extends Error {
  name = 'AccessTokenInvalidError';
}

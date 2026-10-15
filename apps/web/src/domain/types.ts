export interface AuthUser {
  id: string;
  email: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface SessionPayload {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface RegisterResult {
  id: string;
  email: string;
}

export interface AccountView {
  id: string;
  currency: 'COP';
  balance: string;
}

export type TransferType = 'INTERNAL' | 'EXTERNAL';

export type TransferStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN' | 'REVERSED';

export type FailureReason = 'INSUFFICIENT_FUNDS' | 'RAIL_REJECTED' | 'RAIL_UNAVAILABLE' | string;

export type ReversalStatus = 'PENDING' | 'COMPLETED' | 'REJECTED' | 'UNKNOWN';

export interface ReversalView {
  id: string;
  status: ReversalStatus;
  failureReason?: FailureReason | null;
}

export interface TransferView {
  id: string;
  type: TransferType;
  fromAccountId: string;
  toAccountId?: string | null;
  toExternalAccount?: string | null;
  amount: string;
  currency: 'COP';
  status: TransferStatus;
  failureReason?: FailureReason | null;
  createdAt: string;
  completedAt?: string | null;
  reversal?: ReversalView | null;
}

export interface TransferPage {
  items: TransferView[];
  nextCursor: string | null;
}

export interface AuditEvent {
  eventId: string;
  eventType: string;
  occurredAt: string;
  data?: {
    status?: string;
    previousStatus?: string | null;
    failureReason?: string | null;
    reversalStatus?: string | null;
  };
}

export type FieldErrorCode =
  | 'emailRequired'
  | 'emailInvalid'
  | 'emailTooLong'
  | 'passwordRequired'
  | 'passwordLength'
  | 'amountInvalid'
  | 'destinationRequired'
  | 'destinationSame'
  | 'destinationTooLong'
  | 'externalInvalid'
  | 'originRequired';

export type FieldErrors = Partial<Record<string, FieldErrorCode>>;

export interface TransferDraft {
  type: TransferType;
  fromAccountId: string;
  toAccountId: string;
  toExternalAccount: string;
  amount: string;
}

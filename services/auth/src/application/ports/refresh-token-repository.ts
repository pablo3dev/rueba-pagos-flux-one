// port: out — persistencia de refresh tokens con rotación atómica
import type { RefreshToken } from '../../domain/refresh-token.js';

export type RotationOutcome =
  | { status: 'ROTATED'; userId: string; familyId: string }
  | { status: 'REUSED'; userId: string; familyId: string }
  | { status: 'EXPIRED' }
  | { status: 'NOT_FOUND' };

export interface RefreshTokenRepository {
  insert(token: RefreshToken): Promise<void>;
  rotate(input: {
    currentTokenHash: string;
    now: Date;
    next: { id: string; tokenHash: string; expiresAt: Date };
  }): Promise<RotationOutcome>;
  revokeFamilyByTokenHash(tokenHash: string, now: Date): Promise<void>;
}

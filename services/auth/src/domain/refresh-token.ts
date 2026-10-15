export interface RefreshToken {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string; // SHA-256 hex, 64 caracteres
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
}

export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const REFRESH_TOKEN_TTL_SECONDS = 604800;

export type RotationDecision = 'ROTATE' | 'REUSED' | 'EXPIRED';

// Función pura. Orden de evaluación fijo.
export function decideRotation(
  token: { revokedAt: Date | null; expiresAt: Date },
  now: Date,
): RotationDecision {
  if (token.revokedAt !== null) return 'REUSED';
  if (token.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'ROTATE';
}

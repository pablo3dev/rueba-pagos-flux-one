import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  decideRotation,
} from '../../../src/domain/refresh-token.js';

const NOW = new Date('2026-01-01T12:00:00.000Z');
const FUTURE = new Date('2026-01-01T12:00:01.000Z');
const PAST = new Date('2026-01-01T11:59:59.000Z');

describe('decideRotation', () => {
  it('[AC-AUT-11] token vigente y no revocado → ROTATE', () => {
    expect(decideRotation({ revokedAt: null, expiresAt: FUTURE }, NOW)).toBe('ROTATE');
  });

  it('[AC-AUT-13] token no revocado y expirado → EXPIRED', () => {
    expect(decideRotation({ revokedAt: null, expiresAt: PAST }, NOW)).toBe('EXPIRED');
  });

  it('[AC-AUT-13] token que expira exactamente en este instante → EXPIRED', () => {
    expect(decideRotation({ revokedAt: null, expiresAt: NOW }, NOW)).toBe('EXPIRED');
  });

  it('[AC-AUT-12] token revocado y vigente → REUSED', () => {
    expect(decideRotation({ revokedAt: PAST, expiresAt: FUTURE }, NOW)).toBe('REUSED');
  });

  it('[AC-AUT-12] token revocado y expirado → REUSED (la revocación se evalúa primero)', () => {
    expect(decideRotation({ revokedAt: PAST, expiresAt: PAST }, NOW)).toBe('REUSED');
  });
});

describe('vigencias', () => {
  it('[AC-AUT-14] el refresh token vive 7 días', () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it('[AC-AUT-09] el access token vive 15 minutos', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
  });
});

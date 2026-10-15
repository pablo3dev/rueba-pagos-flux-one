import { createHash } from 'node:crypto';
import type { Clock } from '../../src/application/ports/clock.js';
import type { OpaqueTokenGenerator } from '../../src/application/ports/opaque-token-generator.js';
import type { PasswordHasher } from '../../src/application/ports/password-hasher.js';
import type {
  RefreshTokenRepository,
  RotationOutcome,
} from '../../src/application/ports/refresh-token-repository.js';
import type { SigningKeyGenerator } from '../../src/application/ports/signing-key-generator.js';
import type { SigningKeyRepository } from '../../src/application/ports/signing-key-repository.js';
import type { TokenIssuer } from '../../src/application/ports/token-issuer.js';
import type { UserRepository } from '../../src/application/ports/user-repository.js';
import { AccessTokenInvalidError, EmailAlreadyRegisteredError } from '../../src/domain/errors.js';
import { decideRotation, type RefreshToken } from '../../src/domain/refresh-token.js';
import type { PublicJwk, SigningKey } from '../../src/domain/signing-key.js';
import type { User } from '../../src/domain/user.js';

export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-01-01T12:00:00.000Z')) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(date: Date): void {
    this.current = date;
  }
}

// hash = "hashed:<plain>"; registra las llamadas a `hash` y `verify` para poder afirmarlas.
export class FakePasswordHasher implements PasswordHasher {
  readonly hashCalls: string[] = [];
  readonly verifyCalls: { hash: string; plain: string }[] = [];

  async hash(plain: string): Promise<string> {
    this.hashCalls.push(plain);
    return `hashed:${plain}`;
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    this.verifyCalls.push({ hash, plain });
    return hash === `hashed:${plain}`;
  }
}

// Tokens deterministas ("opaque-1", "opaque-2", ...) con SHA-256 hex real como huella.
export class FakeOpaqueTokenGenerator implements OpaqueTokenGenerator {
  private counter = 0;

  generate(): { token: string; tokenHash: string } {
    this.counter += 1;
    const token = `opaque-${this.counter}`;
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export class FakeSigningKeyGenerator implements SigningKeyGenerator {
  generateCalls = 0;

  constructor(private readonly clock: Clock) {}

  async generate(): Promise<SigningKey> {
    this.generateCalls += 1;
    const kid = `00000000-0000-4000-8000-${String(this.generateCalls).padStart(12, '0')}`;
    return {
      kid,
      alg: 'EdDSA',
      publicJwk: { kty: 'OKP', crv: 'Ed25519', x: `x-${kid}`, kid, alg: 'EdDSA', use: 'sig' },
      privateKeyPkcs8: `private-${kid}`,
      active: true,
      createdAt: this.clock.now(),
    };
  }
}

// Access token fake: "access:<id>"; solo verifica los que emitió.
export class FakeTokenIssuer implements TokenIssuer {
  private readonly issued = new Map<string, { userId: string; email: string }>();

  async issueAccessToken(user: {
    id: string;
    email: string;
  }): Promise<{ accessToken: string; expiresIn: number }> {
    const accessToken = `access:${user.id}`;
    this.issued.set(accessToken, { userId: user.id, email: user.email });
    return { accessToken, expiresIn: 900 };
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; email: string }> {
    const claims = this.issued.get(token);
    if (claims === undefined) throw new AccessTokenInvalidError();
    return claims;
  }

  getJwks(): { keys: PublicJwk[] } {
    return { keys: [] };
  }
}

export class InMemoryUserRepository implements UserRepository {
  readonly users: User[] = [];

  async insert(user: User): Promise<void> {
    if (this.users.some((u) => u.email === user.email)) throw new EmailAlreadyRegisteredError();
    this.users.push(user);
  }

  async insertIfAbsent(user: User): Promise<void> {
    if (this.users.some((u) => u.id === user.id || u.email === user.email)) return;
    this.users.push(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }
}

// Reproduce la semántica de `rotate` y `revokeFamilyByTokenHash` de design.md §4.1 en memoria.
export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly tokens: RefreshToken[] = [];
  readonly revokeFamilyCalls: { tokenHash: string; now: Date }[] = [];

  async insert(token: RefreshToken): Promise<void> {
    this.tokens.push(token);
  }

  async rotate(input: {
    currentTokenHash: string;
    now: Date;
    next: { id: string; tokenHash: string; expiresAt: Date };
  }): Promise<RotationOutcome> {
    const current = this.tokens.find((t) => t.tokenHash === input.currentTokenHash);
    if (current === undefined) return { status: 'NOT_FOUND' };

    const { userId, familyId } = current;
    const decision = decideRotation(current, input.now);
    if (decision === 'REUSED') {
      this.revokeFamily(familyId, input.now);
      return { status: 'REUSED', userId, familyId };
    }
    if (decision === 'EXPIRED') return { status: 'EXPIRED' };

    this.tokens.push({
      id: input.next.id,
      userId,
      familyId,
      tokenHash: input.next.tokenHash,
      expiresAt: input.next.expiresAt,
      revokedAt: null,
      replacedById: null,
      createdAt: input.now,
    });
    current.revokedAt = input.now;
    current.replacedById = input.next.id;
    return { status: 'ROTATED', userId, familyId };
  }

  async revokeFamilyByTokenHash(tokenHash: string, now: Date): Promise<void> {
    this.revokeFamilyCalls.push({ tokenHash, now });
    const token = this.tokens.find((t) => t.tokenHash === tokenHash);
    if (token !== undefined) this.revokeFamily(token.familyId, now);
  }

  private revokeFamily(familyId: string, now: Date): void {
    for (const token of this.tokens) {
      if (token.familyId === familyId && token.revokedAt === null) token.revokedAt = now;
    }
  }
}

export class InMemorySigningKeyRepository implements SigningKeyRepository {
  readonly keys: SigningKey[] = [];

  async findActive(): Promise<SigningKey | null> {
    return this.keys.find((k) => k.active) ?? null;
  }

  async insertIfNoActive(key: SigningKey): Promise<void> {
    if (this.keys.some((k) => k.active)) return;
    this.keys.push(key);
  }

  async listAll(): Promise<SigningKey[]> {
    return [...this.keys];
  }
}

import { importPKCS8 } from 'jose';
import { describe, expect, it } from 'vitest';
import { JoseSigningKeyGenerator } from '../../../src/adapters/outbound/crypto/jose-signing-key-generator.js';
import { FakeClock } from '../../support/fakes.js';

describe('JoseSigningKeyGenerator', () => {
  const clock = new FakeClock(new Date('2026-03-01T10:00:00.000Z'));
  const generator = new JoseSigningKeyGenerator(clock);

  it('[AC-AUT-20] genera una llave Ed25519 EdDSA activa con kid uuid y fecha del reloj', async () => {
    const key = await generator.generate();

    expect(key.kid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(key.alg).toBe('EdDSA');
    expect(key.active).toBe(true);
    expect(key.createdAt).toEqual(new Date('2026-03-01T10:00:00.000Z'));
  });

  it('[AC-AUT-19] la JWK pública solo expone la parte pública (sin `d`)', async () => {
    const key = await generator.generate();

    expect(key.publicJwk).toEqual({
      kty: 'OKP',
      crv: 'Ed25519',
      x: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      kid: key.kid,
      alg: 'EdDSA',
      use: 'sig',
    });
    expect(key.publicJwk).not.toHaveProperty('d');
  });

  it('[AC-AUT-20] la llave privada es PEM PKCS#8 recargable con importPKCS8', async () => {
    const key = await generator.generate();

    expect(key.privateKeyPkcs8.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
    await expect(importPKCS8(key.privateKeyPkcs8, 'EdDSA')).resolves.toBeDefined();
  });

  it('[AC-AUT-20] cada llamada genera un par distinto', async () => {
    const a = await generator.generate();
    const b = await generator.generate();

    expect(a.kid).not.toBe(b.kid);
    expect(a.publicJwk.x).not.toBe(b.publicJwk.x);
  });
});

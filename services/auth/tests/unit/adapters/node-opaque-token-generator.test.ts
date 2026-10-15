import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { NodeOpaqueTokenGenerator } from '../../../src/adapters/outbound/crypto/node-opaque-token-generator.js';

describe('NodeOpaqueTokenGenerator', () => {
  const generator = new NodeOpaqueTokenGenerator();

  it('[AC-AUT-14] el token opaco es base64url y decodifica a 32 bytes', () => {
    const { token } = generator.generate();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('[AC-AUT-14] la huella es SHA-256 hex de 64 caracteres del token', () => {
    const { token, tokenHash } = generator.generate();

    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('[AC-AUT-14] hash(token) coincide con la huella devuelta por generate', () => {
    const { token, tokenHash } = generator.generate();

    expect(generator.hash(token)).toBe(tokenHash);
  });

  it('[AC-AUT-14] hash es SHA-256 hex determinista de la entrada recibida', () => {
    expect(generator.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('[AC-AUT-14] cada token generado es distinto', () => {
    expect(generator.generate().token).not.toBe(generator.generate().token);
  });
});

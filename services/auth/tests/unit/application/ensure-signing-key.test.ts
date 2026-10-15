import { describe, expect, it } from 'vitest';
import { EnsureSigningKey } from '../../../src/application/use-cases/ensure-signing-key.js';
import {
  FakeClock,
  FakeSigningKeyGenerator,
  InMemorySigningKeyRepository,
} from '../../support/fakes.js';

function setup() {
  const signingKeys = new InMemorySigningKeyRepository();
  const generator = new FakeSigningKeyGenerator(new FakeClock());
  return {
    signingKeys,
    generator,
    ensureSigningKey: new EnsureSigningKey({ signingKeys, generator }),
  };
}

describe('EnsureSigningKey', () => {
  it('[AC-AUT-20] sin llave activa genera una, la persiste y la devuelve', async () => {
    const { signingKeys, generator, ensureSigningKey } = setup();

    const keys = await ensureSigningKey.execute();

    expect(generator.generateCalls).toBe(1);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.active).toBe(true);
    expect(signingKeys.keys).toEqual(keys);
  });

  it('[AC-AUT-20] con una llave activa existente la reutiliza sin generar otra (reinicio)', async () => {
    const { generator, ensureSigningKey } = setup();
    const first = await ensureSigningKey.execute();

    const second = await ensureSigningKey.execute();

    expect(generator.generateCalls).toBe(1);
    expect(second).toEqual(first);
  });

  it('[AC-AUT-20] si otra instancia gana la carrera conserva una sola llave activa y la devuelve', async () => {
    const { signingKeys, generator, ensureSigningKey } = setup();
    const winner = await new FakeSigningKeyGenerator(new FakeClock()).generate();
    // Esta instancia no ve la llave en `findActive`, pero otra ya la insertó antes de `insertIfNoActive`.
    signingKeys.findActive = async () => {
      await signingKeys.insertIfNoActive(winner);
      return null;
    };

    const keys = await ensureSigningKey.execute();

    expect(generator.generateCalls).toBe(1);
    expect(keys).toEqual([winner]);
    expect(keys.filter((k) => k.active)).toHaveLength(1);
  });
});

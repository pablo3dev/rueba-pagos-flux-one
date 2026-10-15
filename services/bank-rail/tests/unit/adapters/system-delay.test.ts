import { describe, expect, it } from 'vitest';
import { SystemDelay } from '../../../src/adapters/outbound/time/system-delay.js';

describe('SystemDelay', () => {
  it('wait(20) resuelve tras el tiempo indicado y now devuelve una fecha', async () => {
    const delay = new SystemDelay();
    const before = Date.now();
    const now = delay.now();
    const after = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);

    const started = Date.now();
    await delay.wait(20);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });
});

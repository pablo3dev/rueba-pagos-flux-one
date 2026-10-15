import { describe, expect, it } from 'vitest';
import { SerialExecutor } from '../../../src/application/serial-executor.js';

describe('SerialExecutor', () => {
  it('[AC-RIE-10] ejecuta de una en una y en orden de llegada (la segunda no inicia hasta que termina la primera) y el rechazo de una no bloquea las siguientes ni se oculta', async () => {
    const executor = new SerialExecutor();
    const order: string[] = [];
    let releaseFirst: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const failure = new Error('fallo');

    const first = executor.run(async () => {
      order.push('first-start');
      await gate;
      order.push('first-end');
      throw failure;
    });
    const second = executor.run(async () => {
      order.push('second-start');
      return 'second';
    });
    const third = executor.run(async () => {
      order.push('third-start');
      return 'third';
    });

    await Promise.resolve();
    expect(order).toEqual(['first-start']);

    releaseFirst();
    await expect(first).rejects.toBe(failure);
    await expect(second).resolves.toBe('second');
    await expect(third).resolves.toBe('third');
    expect(order).toEqual(['first-start', 'first-end', 'second-start', 'third-start']);
  });
});

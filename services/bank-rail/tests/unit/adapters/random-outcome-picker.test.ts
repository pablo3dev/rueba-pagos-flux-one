import { describe, expect, it } from 'vitest';
import { RandomOutcomePicker } from '../../../src/adapters/outbound/random/random-outcome-picker.js';
import { parseOutcomeWeights, type RailOutcome } from '../../../src/domain/outcome.js';

describe('RandomOutcomePicker', () => {
  it('[AC-RIE-06] RandomOutcomePicker con random inyectado reparte según los pesos y pickTimeoutProcessed cambia en el umbral 0.5', () => {
    const even = new RandomOutcomePicker(
      parseOutcomeWeights('1,1,1,1'),
      scriptedRandom([0, 0.25, 0.5, 0.75]),
    );
    expect([even.pick(), even.pick(), even.pick(), even.pick()]).toEqual([
      'ACCEPTED',
      'REJECTED',
      'UNAVAILABLE',
      'TIMEOUT',
    ] satisfies RailOutcome[]);

    const onlyAccepted = new RandomOutcomePicker(
      parseOutcomeWeights('100,0,0,0'),
      scriptedRandom([0, 0.5, 0.99]),
    );
    expect([onlyAccepted.pick(), onlyAccepted.pick(), onlyAccepted.pick()]).toEqual([
      'ACCEPTED',
      'ACCEPTED',
      'ACCEPTED',
    ]);

    const withGaps = new RandomOutcomePicker(
      parseOutcomeWeights('0,1,0,1'),
      scriptedRandom([0, 0.5]),
    );
    expect([withGaps.pick(), withGaps.pick()]).toEqual(['REJECTED', 'TIMEOUT']);

    const timeout = new RandomOutcomePicker(
      parseOutcomeWeights('1,1,1,1'),
      scriptedRandom([0, 0.49999999999999994, 0.5, 0.75]),
    );
    expect(timeout.pickTimeoutProcessed()).toBe(true);
    expect(timeout.pickTimeoutProcessed()).toBe(true);
    expect(timeout.pickTimeoutProcessed()).toBe(false);
    expect(timeout.pickTimeoutProcessed()).toBe(false);
  });
});

function scriptedRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) {
      throw new Error('La secuencia de random se agotó.');
    }
    return value;
  };
}

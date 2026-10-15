import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/domain/errors.js';
import {
  DEFAULT_OUTCOME_WEIGHTS,
  parseOutcomeWeights,
  pickByWeights,
  totalWeight,
  type OutcomeWeights,
  type RailOutcome,
} from '../../../src/domain/outcome.js';

function expectInvalidWeights(raw: string): void {
  try {
    parseOutcomeWeights(raw);
    expect.fail('debía lanzar ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    const validation = error as ValidationError;
    expect(validation.name).toBe('ValidationError');
    expect(validation.message).not.toContain(raw);
  }
}

describe('parseOutcomeWeights', () => {
  it.each(['1,2,3', 'a,b,c,d', '-1,2,3,4', '0,0,0,0', '25, 25,25,25'])(
    '[AC-RIE-06][AC-RIE-31] rechaza los pesos %s',
    (raw) => {
      expectInvalidWeights(raw);
    },
  );

  it('[AC-RIE-06][AC-RIE-31] acepta 100,0,0,0 y el reparto por defecto', () => {
    expect(parseOutcomeWeights('100,0,0,0')).toEqual({
      ACCEPTED: 100,
      REJECTED: 0,
      UNAVAILABLE: 0,
      TIMEOUT: 0,
    });
    expect(parseOutcomeWeights('25,25,25,25')).toEqual(DEFAULT_OUTCOME_WEIGHTS);
    expect(totalWeight(DEFAULT_OUTCOME_WEIGHTS)).toBe(100);
  });

  it('[AC-RIE-31] rechaza una suma que no es un entero seguro', () => {
    expectInvalidWeights('9007199254740991,1,0,0');
  });
});

describe('pickByWeights', () => {
  it('[AC-RIE-06] respeta los límites de cada tramo', () => {
    const weights: OutcomeWeights = {
      ACCEPTED: 25,
      REJECTED: 25,
      UNAVAILABLE: 25,
      TIMEOUT: 25,
    };
    expect(totalWeight(weights)).toBe(100);
    expect(pickByWeights(weights, 0)).toBe('ACCEPTED');
    expect(pickByWeights(weights, 24)).toBe('ACCEPTED');
    expect(pickByWeights(weights, 25)).toBe('REJECTED');
    expect(pickByWeights(weights, 49)).toBe('REJECTED');
    expect(pickByWeights(weights, 50)).toBe('UNAVAILABLE');
    expect(pickByWeights(weights, 74)).toBe('UNAVAILABLE');
    expect(pickByWeights(weights, 75)).toBe('TIMEOUT');
    expect(pickByWeights(weights, 99)).toBe('TIMEOUT');
  });

  it('[AC-RIE-06] nunca devuelve un resultado de peso 0', () => {
    const onlyAccepted = parseOutcomeWeights('100,0,0,0');
    for (let roll = 0; roll < totalWeight(onlyAccepted); roll += 1) {
      expect(pickByWeights(onlyAccepted, roll)).toBe('ACCEPTED');
    }

    const withGaps = parseOutcomeWeights('0,2,0,3');
    const seen = new Set<RailOutcome>();
    for (let roll = 0; roll < totalWeight(withGaps); roll += 1) {
      const outcome = pickByWeights(withGaps, roll);
      expect(withGaps[outcome]).toBeGreaterThan(0);
      seen.add(outcome);
    }
    expect(seen).toEqual(new Set<RailOutcome>(['REJECTED', 'TIMEOUT']));
    expect(pickByWeights(withGaps, 0)).toBe('REJECTED');
    expect(pickByWeights(withGaps, 1)).toBe('REJECTED');
    expect(pickByWeights(withGaps, 2)).toBe('TIMEOUT');
    expect(pickByWeights(withGaps, 4)).toBe('TIMEOUT');
  });
});

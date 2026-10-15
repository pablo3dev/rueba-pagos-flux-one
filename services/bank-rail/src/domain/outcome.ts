import { ValidationError } from './errors.js';

export type RailOutcome = 'ACCEPTED' | 'REJECTED' | 'UNAVAILABLE' | 'TIMEOUT';

export type OutcomeWeights = Record<RailOutcome, number>;

const OUTCOME_ORDER = ['ACCEPTED', 'REJECTED', 'UNAVAILABLE', 'TIMEOUT'] as const;

const WEIGHTS_PATTERN = /^[0-9]+(,[0-9]+){3}$/;

const WEIGHTS_MESSAGE =
  'Los pesos deben ser cuatro enteros no negativos separados por comas, ' +
  'cada uno seguro y con suma mayor que cero.';

export const DEFAULT_OUTCOME_WEIGHTS: OutcomeWeights = {
  ACCEPTED: 25,
  REJECTED: 25,
  UNAVAILABLE: 25,
  TIMEOUT: 25,
};

export function parseOutcomeWeights(raw: string): OutcomeWeights {
  if (!WEIGHTS_PATTERN.test(raw)) {
    throw new ValidationError(WEIGHTS_MESSAGE);
  }
  const parts = raw.split(',').map((part) => Number(part));
  if (parts.some((value) => !Number.isSafeInteger(value))) {
    throw new ValidationError(WEIGHTS_MESSAGE);
  }
  const [accepted, rejected, unavailable, timeout] = parts;
  if (
    accepted === undefined ||
    rejected === undefined ||
    unavailable === undefined ||
    timeout === undefined
  ) {
    throw new ValidationError(WEIGHTS_MESSAGE);
  }
  const sum = accepted + rejected + unavailable + timeout;
  if (!Number.isSafeInteger(sum) || sum <= 0) {
    throw new ValidationError(WEIGHTS_MESSAGE);
  }
  return {
    ACCEPTED: accepted,
    REJECTED: rejected,
    UNAVAILABLE: unavailable,
    TIMEOUT: timeout,
  };
}

export function totalWeight(weights: OutcomeWeights): number {
  return OUTCOME_ORDER.reduce((sum, outcome) => sum + weights[outcome], 0);
}

export function pickByWeights(weights: OutcomeWeights, roll: number): RailOutcome {
  let cumulative = 0;
  for (const outcome of OUTCOME_ORDER) {
    const weight = weights[outcome];
    cumulative += weight;
    if (weight > 0 && cumulative > roll) {
      return outcome;
    }
  }
  throw new ValidationError('El número sorteado no corresponde a un resultado con peso.');
}

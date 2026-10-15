// adapter: out — Math.random
import type { OutcomePicker } from '../../../application/ports/outcome-picker.js';
import {
  pickByWeights,
  totalWeight,
  type OutcomeWeights,
  type RailOutcome,
} from '../../../domain/outcome.js';

export class RandomOutcomePicker implements OutcomePicker {
  constructor(
    private readonly weights: OutcomeWeights,
    private readonly random: () => number = Math.random,
  ) {}

  pick(): RailOutcome {
    return pickByWeights(this.weights, Math.floor(this.random() * totalWeight(this.weights)));
  }

  pickTimeoutProcessed(): boolean {
    return this.random() < 0.5;
  }
}

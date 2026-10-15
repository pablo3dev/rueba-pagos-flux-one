// adapter: out — node:timers/promises
import { setTimeout } from 'node:timers/promises';
import type { Delay } from '../../../application/ports/delay.js';

export class SystemDelay implements Delay {
  async wait(ms: number): Promise<void> {
    await setTimeout(ms);
  }

  now(): Date {
    return new Date();
  }
}

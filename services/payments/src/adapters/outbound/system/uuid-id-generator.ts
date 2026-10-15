// adapter: out — uuid v4
import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../../application/ports/id-generator.js';

export class UuidIdGenerator implements IdGenerator {
  newId(): string {
    return randomUUID();
  }
}

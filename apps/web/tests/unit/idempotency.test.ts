import { describe, expect, it } from 'vitest';
import {
  intentAfterResult,
  intentForSubmit,
  isRetryableFailure,
} from '../../src/domain/idempotency';

describe('idempotency', () => {
  it('reuses the key for the same payload and rotates it when the payload changes', () => {
    let n = 0;
    const first = intentForSubmit(null, '{"amount":"10"}', () => `key-${++n}`);
    const retry = intentForSubmit(first, '{"amount":"10"}', () => `key-${++n}`);
    const changed = intentForSubmit(first, '{"amount":"11"}', () => `key-${++n}`);
    expect(retry.key).toBe(first.key);
    expect(changed.key).not.toBe(first.key);
  });

  it('keeps the key after a retryable failure and drops it after an effect', () => {
    const intent = { key: 'same', payload: '{}' };
    expect(intentAfterResult(intent, 'retryable')).toEqual(intent);
    expect(intentAfterResult(intent, 'effect')).toBeNull();
    expect(isRetryableFailure(0, 'NETWORK_ERROR')).toBe(true);
    expect(isRetryableFailure(503, 'SERVICE_UNAVAILABLE')).toBe(true);
    expect(isRetryableFailure(409, 'IDEMPOTENCY_KEY_IN_PROGRESS')).toBe(true);
    expect(isRetryableFailure(422, 'SAME_ACCOUNT')).toBe(false);
  });
});

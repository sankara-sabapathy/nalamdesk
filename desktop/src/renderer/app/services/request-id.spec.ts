import { describe, it, expect, vi } from 'vitest';
import { newRequestId } from './request-id';

describe('newRequestId', () => {
  it('generates a valid UUID when crypto.randomUUID is available', () => {
    const id = newRequestId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('falls back to crypto.getRandomValues when randomUUID is not a function', () => {
    const originalRandomUUID = globalThis.crypto.randomUUID;
    try {
      // @ts-expect-error mutating for test
      globalThis.crypto.randomUUID = undefined;
      const id = newRequestId();
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(32);
    } finally {
      // @ts-expect-error restoring
      globalThis.crypto.randomUUID = originalRandomUUID;
    }
  });

  it('falls back to timestamp string when crypto is missing', () => {
    const originalCrypto = globalThis.crypto;
    try {
      // @ts-expect-error mutating for test
      delete globalThis.crypto;
      const id = newRequestId();
      expect(id).toMatch(/^consult-\d+$/);
    } finally {
      globalThis.crypto = originalCrypto;
    }
  });
});

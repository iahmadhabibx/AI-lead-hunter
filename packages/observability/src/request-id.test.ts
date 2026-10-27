import { describe, expect, it } from 'vitest';
import { createRequestId } from './request-id';

describe('createRequestId', () => {
  it('returns a uuid when none provided', () => {
    expect(createRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('preserves a valid existing id', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(createRequestId(id)).toBe(id);
  });
});

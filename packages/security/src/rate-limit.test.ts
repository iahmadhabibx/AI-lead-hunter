import { describe, expect, it } from 'vitest';
import { MemoryRateLimiter } from './rate-limit';

describe('MemoryRateLimiter', () => {
  it('allows up to the limit then blocks within the window', () => {
    const limiter = new MemoryRateLimiter();
    const key = 'auth:1.2.3.4';
    const windowMs = 60_000;
    expect(limiter.check(key, 3, windowMs, 1000).allowed).toBe(true);
    expect(limiter.check(key, 3, windowMs, 1001).allowed).toBe(true);
    expect(limiter.check(key, 3, windowMs, 1002).allowed).toBe(true);
    const blocked = limiter.check(key, 3, windowMs, 1003);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const limiter = new MemoryRateLimiter();
    const key = 'auth:reset';
    limiter.check(key, 1, 1000, 0);
    expect(limiter.check(key, 1, 1000, 500).allowed).toBe(false);
    expect(limiter.check(key, 1, 1000, 1001).allowed).toBe(true);
  });
});

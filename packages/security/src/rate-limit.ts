/**
 * Simple in-process sliding-window rate limiter.
 * Suitable for single-instance MVP; replace with Redis for multi-instance production.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly maxEntries = 50_000) {}

  check(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): RateLimitResult {
    const cutoff = now - windowMs;
    const prev = this.hits.get(key) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + windowMs - now),
      };
    }
    recent.push(now);
    this.hits.set(key, recent);
    this.prune(now, windowMs);
    return {
      allowed: true,
      remaining: Math.max(0, limit - recent.length),
      retryAfterMs: 0,
    };
  }

  reset(key?: string): void {
    if (key) this.hits.delete(key);
    else this.hits.clear();
  }

  private prune(now: number, windowMs: number): void {
    if (this.hits.size <= this.maxEntries) return;
    const cutoff = now - windowMs;
    for (const [k, times] of this.hits) {
      const keep = times.filter((t) => t > cutoff);
      if (keep.length === 0) this.hits.delete(k);
      else this.hits.set(k, keep);
      if (this.hits.size <= this.maxEntries * 0.8) break;
    }
  }
}

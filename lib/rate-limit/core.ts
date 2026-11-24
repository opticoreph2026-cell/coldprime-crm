// Pure rate-limit primitives: fixed windows + an in-memory store.
// Kept free of Prisma so the window math and the memory adapter unit-test cleanly.
// The shared (Postgres) store lives in ./postgres.ts.

export interface RateLimitOptions {
  /** Maximum attempts allowed inside one window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  /** Seconds until the window resets — useful for a Retry-After header. */
  retryAfterSeconds: number;
}

/** Fixed window containing `now`; every window gets its own counter row. */
export function windowFor(now: number, windowMs: number): { start: number; resetAt: Date } {
  const start = Math.floor(now / windowMs) * windowMs;
  return { start, resetAt: new Date(start + windowMs) };
}

export function rateLimitKey(bucket: string, id: string, windowStart: number): string {
  return `${bucket}:${id}:${windowStart}`;
}

export function toResult(count: number, limit: number, resetAt: Date, now = Date.now()): RateLimitResult {
  return {
    allowed: count <= limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
  };
}

/** Per-process fallback. Only correct with a single instance — dev or an explicit opt-out. */
export class MemoryRateLimitStore {
  private counters = new Map<string, { count: number; resetAt: number }>();

  increment(key: string, resetAt: number): number {
    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt });
      this.prune(now);
      return 1;
    }
    current.count++;
    return current.count;
  }

  clear(): void {
    this.counters.clear();
  }

  private prune(now: number): void {
    if (this.counters.size < 1000) return;
    for (const [key, entry] of this.counters) {
      if (entry.resetAt <= now) this.counters.delete(key);
    }
  }
}

export const memoryStore = new MemoryRateLimitStore();

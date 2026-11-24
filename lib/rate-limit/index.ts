// Shared rate limiting entry point.
// Default store: Postgres (works across serverless instances). Set
// RATE_LIMIT_STORE=memory to fall back to a per-process store (local dev/tests).
import { memoryStore, rateLimitKey, toResult, windowFor } from "./core";
import type { RateLimitOptions, RateLimitResult } from "./core";
import { incrementPostgres } from "./postgres";

export type { RateLimitOptions, RateLimitResult } from "./core";

function memoryStoreSelected(): boolean {
  return process.env.RATE_LIMIT_STORE === "memory" || !process.env.DATABASE_URL;
}

/**
 * Count one attempt for `bucket`/`id` and report whether it is still allowed.
 * Fails open on datastore errors: authentication needs the same database, so a
 * broken store cannot be used to bypass a login that would otherwise succeed.
 */
export async function checkRateLimit(
  bucket: string,
  id: string,
  options: RateLimitOptions,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const { start, resetAt } = windowFor(now, options.windowMs);
  const key = rateLimitKey(bucket, id, start);

  try {
    const count = memoryStoreSelected()
      ? memoryStore.increment(key, resetAt.getTime())
      : await incrementPostgres(key, resetAt);
    return toResult(count, options.limit, resetAt, now);
  } catch (error) {
    console.error(`Rate limit check failed (${bucket}):`, error);
    return toResult(0, options.limit, resetAt, now);
  }
}

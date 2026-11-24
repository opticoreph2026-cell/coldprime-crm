import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRateLimitStore, rateLimitKey, toResult, windowFor } from "./core";
import { checkRateLimit } from "./index";

const MINUTE = 60_000;

describe("windowFor", () => {
  it("floors to the window boundary and reports the reset time", () => {
    const now = new Date("2026-11-24T10:07:31.500Z").getTime();
    const { start, resetAt } = windowFor(now, 15 * MINUTE);
    expect(new Date(start).toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(resetAt.toISOString()).toBe("2026-11-24T10:15:00.000Z");
  });

  it("puts the last millisecond of a window in the same bucket", () => {
    const windowMs = 15 * MINUTE;
    const a = windowFor(new Date("2026-11-24T10:00:00.000Z").getTime(), windowMs);
    const b = windowFor(new Date("2026-11-24T10:14:59.999Z").getTime(), windowMs);
    expect(b.start).toBe(a.start);
  });
});

describe("rateLimitKey", () => {
  it("is stable and includes the window start", () => {
    expect(rateLimitKey("login", "1.2.3.4", 1000)).toBe("login:1.2.3.4:1000");
  });
});

describe("MemoryRateLimitStore", () => {
  it("counts within a window and restarts on the next one", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-24T10:00:00.000Z"));
      const store = new MemoryRateLimitStore();
      const resetAt = Date.now() + 15 * MINUTE;

      expect(store.increment("k", resetAt)).toBe(1);
      expect(store.increment("k", resetAt)).toBe(2);

      // jump past the window: the counter restarts
      vi.setSystemTime(new Date("2026-11-24T10:16:00.000Z"));
      expect(store.increment("k", Date.now() + 15 * MINUTE)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clear() empties every counter", () => {
    const store = new MemoryRateLimitStore();
    store.increment("a", Date.now() + MINUTE);
    store.clear();
    expect(store.increment("a", Date.now() + MINUTE)).toBe(1);
  });
});

describe("toResult", () => {
  it("blocks once the count exceeds the limit", () => {
    const resetAt = new Date("2026-11-24T10:15:00.000Z");
    const now = new Date("2026-11-24T10:10:00.000Z").getTime();

    const under = toResult(10, 10, resetAt, now);
    expect(under.allowed).toBe(true);
    expect(under.remaining).toBe(0);
    expect(under.retryAfterSeconds).toBe(300);

    const over = toResult(11, 10, resetAt, now);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });
});

describe("checkRateLimit (memory store)", () => {
  const original = process.env.RATE_LIMIT_STORE;

  beforeEach(() => {
    process.env.RATE_LIMIT_STORE = "memory";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.RATE_LIMIT_STORE;
    else process.env.RATE_LIMIT_STORE = original;
  });

  it("allows exactly `limit` attempts per window, then blocks", async () => {
    const bucket = `test-${Math.random()}`;
    const options = { limit: 3, windowMs: 15 * MINUTE };
    const now = new Date("2026-11-24T12:00:00.000Z").getTime();

    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await checkRateLimit(bucket, "ip", options, now));
    }

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[2].remaining).toBe(0);
    expect(results[3].count).toBe(4);
  });

  it("resets in the next window", async () => {
    const bucket = `test-${Math.random()}`;
    const options = { limit: 1, windowMs: MINUTE };
    const now = new Date("2026-11-24T12:00:00.000Z").getTime();

    expect((await checkRateLimit(bucket, "ip", options, now)).allowed).toBe(true);
    expect((await checkRateLimit(bucket, "ip", options, now)).allowed).toBe(false);
    expect((await checkRateLimit(bucket, "ip", options, now + MINUTE)).allowed).toBe(true);
  });
});

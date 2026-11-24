// Shared fixed-window rate limiting backed by Postgres, so the limit holds across
// every serverless instance. One row per (bucket, id, window): the window start is
// part of the key, which makes the increment a single atomic upsert with no reset logic.
import { prisma } from "@/lib/prisma";

export async function incrementPostgres(key: string, resetAt: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expires_at")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE
      SET "count" = "RateLimit"."count" + 1
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? 1);

  // Opportunistic cleanup keeps the table tiny without a cron job.
  if (count === 1 && Math.random() < 0.01) {
    void prisma.rateLimit
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch((error) => console.error("RateLimit cleanup failed:", error));
  }

  return count;
}

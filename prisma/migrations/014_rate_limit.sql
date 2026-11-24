-- Phase 0: shared fixed-window rate limiter (replaces the in-memory Map in proxy.ts).
-- Additive only; safe to run on a live database.
CREATE TABLE IF NOT EXISTS "RateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "RateLimit_expires_at_idx" ON "RateLimit"("expires_at");

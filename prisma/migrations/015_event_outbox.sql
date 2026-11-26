-- Phase 0: event outbox skeleton (additive; safe on a live database).
-- Every automatable mutation writes its domain event here inside the same
-- transaction as the business change. A worker publishes pending events
-- exactly once (dedupeKey unique constraint) and only executes actions on
-- the whitelist (never approve/issue/mark Won).
CREATE TABLE IF NOT EXISTS "EventOutbox" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "dedupe_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventOutbox_dedupe_key_idx" ON "EventOutbox"("dedupe_key");
CREATE INDEX IF NOT EXISTS "EventOutbox_status_created_at_idx" ON "EventOutbox"("status", "created_at");
CREATE INDEX IF NOT EXISTS "EventOutbox_branch_id_idx" ON "EventOutbox"("branch_id");

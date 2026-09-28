-- Phase 3: contact opt-out + soft-deleted emails
ALTER TABLE "contacts" ADD COLUMN "email_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contacts" ADD COLUMN "email_opt_out_at" TIMESTAMP(3);

ALTER TABLE "email_logs" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "email_logs_deleted_at_idx" ON "email_logs"("deleted_at");

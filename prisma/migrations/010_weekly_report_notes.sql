-- Phase 1.2: tie activities to the logged-in user + weekly report notes
ALTER TABLE "activities"
  ADD COLUMN "performed_by_id" TEXT;

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_performed_by_id_fkey"
  FOREIGN KEY ("performed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "activities_performed_by_id_date_idx"
  ON "activities"("performed_by_id", "date");

CREATE TABLE "weekly_report_notes" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "week_start" TIMESTAMP(3) NOT NULL,
  "highlights" TEXT,
  "blockers" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "weekly_report_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "weekly_report_notes_user_id_week_start_key"
  ON "weekly_report_notes"("user_id", "week_start");

CREATE INDEX "weekly_report_notes_branch_id_week_start_idx"
  ON "weekly_report_notes"("branch_id", "week_start");

ALTER TABLE "weekly_report_notes"
  ADD CONSTRAINT "weekly_report_notes_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "weekly_report_notes"
  ADD CONSTRAINT "weekly_report_notes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

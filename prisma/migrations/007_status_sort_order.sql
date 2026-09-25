-- Sortable status definitions for the /admin/statuses screen
ALTER TABLE status_definitions ADD COLUMN IF NOT EXISTS "sortOrder" Integer NOT NULL DEFAULT 0;
UPDATE status_definitions s SET "sortOrder" = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY branch_id, type ORDER BY name) AS rn
  FROM status_definitions
) sub
WHERE s.id = sub.id;

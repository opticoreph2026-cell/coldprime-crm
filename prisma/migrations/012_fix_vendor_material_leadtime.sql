-- Correction to 011: VendorMaterial.leadTimeDays has no @map, so the column
-- must be camelCase (matching vendor_materials' existing naming). 011 was run
-- against live with the snake_case name; swap it for the correct column.
-- Safe on fresh databases (both statements become no-ops after corrected 011).
ALTER TABLE "vendor_materials" DROP COLUMN IF EXISTS "lead_time_days";
ALTER TABLE "vendor_materials" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER;

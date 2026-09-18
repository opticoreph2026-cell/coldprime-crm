-- Coldprime CRM: Multi-Phone Migration
-- Run this on Supabase SQL Editor before running prisma db push

-- Step 1: Add 6 new phone columns
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "mobile1" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "mobile2" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "mobile3" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "landline1" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "landline2" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "landline3" TEXT;

-- Step 2: Migrate existing phone data to mobile1
UPDATE "companies" SET "mobile1" = "phone" WHERE "phone" IS NOT NULL AND "phone" != '';

-- Step 3: Drop old phone column (uncomment after verifying data migrated)
-- ALTER TABLE "companies" DROP COLUMN "phone";

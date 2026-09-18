-- Coldprime CRM: Multi-Branch Migration
-- Run this on Supabase SQL Editor before running prisma db push

-- Step 1: Create branches table
CREATE TABLE IF NOT EXISTS "branches" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "branches_slug_key" ON "branches"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "branches_domain_key" ON "branches"("domain");

-- Step 2: Create default branches
INSERT INTO "branches" ("id", "name", "slug", "domain", "is_active", "created_at")
VALUES
  ('branch_cebu', 'Cebu Office', 'cebu', 'cebu.coldprime-crm.vercel.app', true, NOW()),
  ('branch_manila', 'Manila Office', 'manila', 'manila.coldprime-crm.vercel.app', true, NOW())
ON CONFLICT ("slug") DO NOTHING;

-- Step 3: Create users table (replaces admin_users)
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'STAFF',
  "branch_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_branch_id_idx" ON "users"("branch_id");

-- Step 4: Migrate existing admin_users to users (cebu branch)
INSERT INTO "users" ("id", "email", "name", "password", "role", "branch_id", "is_active", "created_at", "updated_at")
SELECT
  "id",
  "email",
  COALESCE("name", 'Administrator'),
  "password",
  'HEAD_ADMIN',
  'branch_cebu',
  true,
  "created_at",
  "updated_at"
FROM "admin_users"
ON CONFLICT ("email") DO NOTHING;

-- Step 5: Add branch_id to companies (nullable first)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
UPDATE "companies" SET "branch_id" = 'branch_cebu' WHERE "branch_id" IS NULL;
ALTER TABLE "companies" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "companies" ADD CONSTRAINT "companies_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "companies_branch_id_idx" ON "companies"("branch_id");
CREATE INDEX IF NOT EXISTS "companies_branch_id_name_idx" ON "companies"("branch_id", "name");
CREATE INDEX IF NOT EXISTS "companies_branch_id_status_idx" ON "companies"("branch_id", "status");

-- Step 6: Add branch_id to contacts
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
UPDATE "contacts" SET "branch_id" = 'branch_cebu' WHERE "branch_id" IS NULL;
ALTER TABLE "contacts" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "contacts_branch_id_idx" ON "contacts"("branch_id");

-- Step 7: Add branch_id to leads
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
UPDATE "leads" SET "branch_id" = 'branch_cebu' WHERE "branch_id" IS NULL;
ALTER TABLE "leads" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "leads_branch_id_idx" ON "leads"("branch_id");
CREATE INDEX IF NOT EXISTS "leads_branch_id_status_idx" ON "leads"("branch_id", "status");

-- Step 8: Add branch_id to projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
UPDATE "projects" SET "branch_id" = 'branch_cebu' WHERE "branch_id" IS NULL;
ALTER TABLE "projects" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "projects" ADD CONSTRAINT "projects_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "projects_branch_id_idx" ON "projects"("branch_id");
CREATE INDEX IF NOT EXISTS "projects_branch_id_status_idx" ON "projects"("branch_id", "status");

-- Step 9: Add branch_id to activities
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
UPDATE "activities" SET "branch_id" = 'branch_cebu' WHERE "branch_id" IS NULL;
ALTER TABLE "activities" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "activities" ADD CONSTRAINT "activities_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "activities_branch_id_idx" ON "activities"("branch_id");
CREATE INDEX IF NOT EXISTS "activities_branch_id_date_idx" ON "activities"("branch_id", "date");

-- Step 10: Add branch_id to status_definitions
ALTER TABLE "status_definitions" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
UPDATE "status_definitions" SET "branch_id" = 'branch_cebu' WHERE "branch_id" IS NULL;
ALTER TABLE "status_definitions" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "status_definitions" ADD CONSTRAINT "status_definitions_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "status_definitions_branch_id_idx" ON "status_definitions"("branch_id");
-- Recreate unique constraint to include branch_id
ALTER TABLE "status_definitions" DROP CONSTRAINT IF EXISTS "status_definitions_name_type_key";
ALTER TABLE "status_definitions" ADD CONSTRAINT "status_definitions_branch_id_name_type_key"
  UNIQUE ("branch_id", "name", "type");

-- Step 11: Add branch_id to import_batches
ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
UPDATE "import_batches" SET "branch_id" = 'branch_cebu' WHERE "branch_id" IS NULL;
ALTER TABLE "import_batches" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "import_batches_branch_id_idx" ON "import_batches"("branch_id");

-- Step 12: Create audit_logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "branch_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT,
  "details" JSONB,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_branch_id_idx" ON "audit_logs"("branch_id");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_branch_id_created_at_idx" ON "audit_logs"("branch_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 13: Drop old admin_users table (after verifying data migrated)
-- Uncomment after verifying:
-- DROP TABLE IF EXISTS "admin_users";

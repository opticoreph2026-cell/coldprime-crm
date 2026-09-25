-- 008: drop leftover objects unrelated to the current schema
-- admin_users: legacy pre-001 login table; its single row (admin@coldprime.ph) was migrated
-- to users (HEAD_ADMIN). No application code references this table (see migration 001 Step 13).
DROP TABLE IF EXISTS "admin_users";

-- companies.phone: legacy single phone column superseded by mobile1-3/landline1-3.
-- All 7 populated rows verified as exact duplicates of mobile1 or landline1 before dropping.
ALTER TABLE "companies" DROP COLUMN IF EXISTS "phone";

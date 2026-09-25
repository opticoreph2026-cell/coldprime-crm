-- 009: align DB CompanyType enum with prisma/schema.prisma and lib/enums.ts (14 HVAC/IAQ values)
-- Removes the 4 legacy values from 004 (ARCHITECT, DEVELOPER, PROPERTY_MANAGER, END_CLIENT).
-- Verified: all 19 companies use OTHER; no rows reference legacy values.

ALTER TABLE "companies" ALTER COLUMN "type" DROP DEFAULT;

ALTER TYPE "CompanyType" RENAME TO "CompanyType_legacy";

CREATE TYPE "CompanyType" AS ENUM (
  'GENERAL_CONTRACTOR','MEPF_CONSULTANT','PROPERTY_DEVELOPER','FACILITY_MANAGER',
  'BUILDING_OWNER','HEALTHCARE','HOSPITALITY','EDUCATION','RETAIL_MALL','INDUSTRIAL',
  'FOOD_BEVERAGE','GOVERNMENT','DATA_CENTER','OTHER'
);

ALTER TABLE "companies"
  ALTER COLUMN "type" TYPE "CompanyType"
  USING ("type"::text::"CompanyType");

ALTER TABLE "companies" ALTER COLUMN "type" SET DEFAULT 'OTHER';

DROP TYPE "CompanyType_legacy";

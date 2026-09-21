-- Coldprime CRM: Add activeBranchId to User table
-- Run this on Supabase SQL Editor

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_branch_id" VARCHAR(255);

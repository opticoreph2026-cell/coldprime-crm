-- Phase 2: Products (sell-side price book) + lead time on price rows
CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "brand" TEXT,
  "model" TEXT,
  "unit" TEXT,
  "sell_price" DECIMAL(12, 2),
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "price_valid_until" TIMESTAMP(3),
  "lead_time_days" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "products_branch_id_idx" ON "products"("branch_id");

CREATE INDEX "products_branch_id_category_idx" ON "products"("branch_id", "category");

ALTER TABLE "products"
  ADD CONSTRAINT "products_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_materials" ADD COLUMN "lead_time_days" INTEGER;

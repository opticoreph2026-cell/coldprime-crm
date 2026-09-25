-- vendor FK columns were created as snake_case by hand but the Prisma schema
-- expects camelCase vendorId (no @map). Rename to align (indexes/FKs follow the column).
ALTER TABLE vendor_contacts RENAME COLUMN vendor_id TO "vendorId";
ALTER TABLE vendor_materials RENAME COLUMN vendor_id TO "vendorId";

-- Drop the package_venues join table first (FK to venues with RESTRICT)
DROP TABLE IF EXISTS "package_venues";

-- Remove venue_id FK column from catalog_pages
ALTER TABLE "catalog_pages" DROP COLUMN IF EXISTS "venue_id";

-- Drop the venues table
DROP TABLE IF EXISTS "venues";

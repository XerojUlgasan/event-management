-- This migration sorts before 20261118100000_add_thumbnail_to_catalog,
-- which creates these constraints. Allow replay before they exist.
ALTER TABLE "packages" DROP CONSTRAINT IF EXISTS "packages_thumbnail_media_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_thumbnail_media_id_fkey";

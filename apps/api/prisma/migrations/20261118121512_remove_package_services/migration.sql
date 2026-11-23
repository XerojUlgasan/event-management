/*
  Warnings:

  - You are about to drop the `package_services` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN;
SET LOCAL lock_timeout = '5s';

-- These derived overviews may still describe the removed included/optional
-- assignments. Leave source content and all other knowledge chunks intact;
-- the normal catalog embedding workflow recreates current overview text.
DELETE FROM "catalog_knowledge" AS knowledge
USING "package_services" AS assignment
WHERE knowledge.package_id = assignment.package_id
  AND (knowledge.chunk_key = 'overview' OR knowledge.chunk_key LIKE 'overview:%');

-- DropForeignKey
ALTER TABLE "package_services" DROP CONSTRAINT "package_services_package_id_fkey";

-- DropForeignKey
ALTER TABLE "package_services" DROP CONSTRAINT "package_services_service_id_fkey";

-- DropTable
DROP TABLE "package_services";

COMMIT;

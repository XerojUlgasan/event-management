/*
  Warnings:

  - You are about to drop the `event_checklists` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN;

-- DropForeignKey
ALTER TABLE "event_checklists" DROP CONSTRAINT "event_checklists_created_by_fkey";

-- DropForeignKey
ALTER TABLE "event_checklists" DROP CONSTRAINT "event_checklists_event_day_id_fkey";

-- DropForeignKey
ALTER TABLE "event_checklists" DROP CONSTRAINT "event_checklists_updated_by_fkey";

-- DropTable
DROP TABLE "event_checklists";

-- SQL-owned validation is no longer needed once the checklist table is gone.
DROP FUNCTION "clemora_checklist_content_valid"(jsonb);

COMMIT;

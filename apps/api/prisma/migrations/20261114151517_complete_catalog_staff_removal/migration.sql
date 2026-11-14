BEGIN;

-- Keep account identities and linked history, with no promotion of old job titles.
-- Only the admins who already had administrative access retain that role.
DELETE FROM sessions
WHERE user_id IN (
  SELECT id FROM users
  WHERE role = 'staff'
     OR (role = 'admin' AND staff_role IS DISTINCT FROM 'System Administrator')
);
UPDATE users
SET role = 'customer', updated_at = now()
WHERE role = 'staff'
   OR (role = 'admin' AND staff_role IS DISTINCT FROM 'System Administrator');
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'customer'));

-- The preceding venue removal dropped the owner column before deleting venues.
-- Delete those ownerless pages and their cascading sections/widgets, retaining
-- media assets because another live catalog page may still reference them.
DELETE FROM catalog_pages WHERE package_id IS NULL AND service_id IS NULL;
ALTER TABLE catalog_pages ADD CONSTRAINT catalog_pages_one_owner
  CHECK (num_nonnulls(package_id, service_id) = 1);

-- Retain checklist tasks and revisions as private admin documents; delivery
-- metadata is obsolete once staff and coordinator handoffs are removed.
-- DropForeignKey
ALTER TABLE "event_checklists" DROP CONSTRAINT "event_checklists_coordinator_id_fkey";

-- DropForeignKey
ALTER TABLE "event_checklists" DROP CONSTRAINT "event_checklists_sent_by_fkey";

-- DropIndex
DROP INDEX "event_checklists_coordinator_id_updated_at_idx";

-- DropIndex
DROP INDEX "event_checklists_sent_by_idx";

-- AlterTable
ALTER TABLE "event_checklists" DROP COLUMN "coordinator_id",
DROP COLUMN "sent_at",
DROP COLUMN "sent_by";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "staff_role";

COMMIT;

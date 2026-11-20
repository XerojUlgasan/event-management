-- Conversation availability is derived from ownership and saved messages.
-- Retain every conversation, message, booking, quotation and AI preference.
BEGIN;

ALTER TABLE "conversations" DROP CONSTRAINT "conversations_owner_check";
DROP INDEX "conversations_active_guest_identity_key";

-- DropIndex
DROP INDEX "conversations_status_idx";

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "closed_at",
DROP COLUMN "guest_expires_at",
DROP COLUMN "status";

-- CreateIndex
CREATE INDEX "conversations_guest_activity_idx" ON "conversations"("guest_identity_id", "created_at" DESC, "id" DESC);

-- Keep exclusive ownership and guest-only booking restrictions without a deadline.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_check" CHECK (
  ("customer_id" IS NOT NULL AND "guest_identity_id" IS NULL)
  OR ("customer_id" IS NULL AND "guest_identity_id" IS NOT NULL
      AND "claimed_guest_identity_id" IS NULL AND "booking_request_id" IS NULL)
);

COMMIT;

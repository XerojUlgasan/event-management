-- Remove only automated replies and AI handoff/takeover notices. Every human
-- message and conversation remains intact.
DELETE FROM "messages" WHERE "sender_role" IN ('assistant', 'system');

ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_sender_role_check";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_sender_role_matches_id_check";
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_role_check"
    CHECK ("sender_role" IN ('customer', 'admin'));
ALTER TABLE "messages" ALTER COLUMN "sender_id" SET NOT NULL;

-- Human messaging keeps its active/closed lifecycle without AI routing state.
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_status_check";
UPDATE "conversations" SET "status" = 'active' WHERE "status" IN ('waiting_staff', 'staff');
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_status_check"
    CHECK ("status" IN ('active', 'closed'));

ALTER TABLE "conversations" DROP COLUMN IF EXISTS "guest_chat_id";

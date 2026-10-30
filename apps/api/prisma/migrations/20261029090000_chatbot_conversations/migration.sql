-- Extend the existing customer conversation into the shared AI/staff thread.
-- Guests stay in the browser until they sign in; only claimed conversations are stored here.
ALTER TABLE "conversations"
    ADD COLUMN "package_id" UUID,
    ADD COLUMN "event_type" TEXT,
    ADD COLUMN "event_starts_at" TIMESTAMPTZ(6),
    ADD COLUMN "event_ends_at" TIMESTAMPTZ(6),
    ADD COLUMN "guest_count" INTEGER,
    ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN "closed_at" TIMESTAMPTZ(6),
    ADD COLUMN "guest_chat_id" TEXT;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "conversations_status_idx" ON "conversations"("status");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_status_check"
    CHECK ("status" IN ('active', 'waiting_staff', 'staff', 'closed'));

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_event_range_check"
    CHECK ("event_starts_at" IS NULL OR "event_ends_at" IS NULL OR "event_ends_at" >= "event_starts_at");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_guest_count_check"
    CHECK ("guest_count" IS NULL OR "guest_count" > 0);

-- Existing messages are either from the customer or from an admin.
ALTER TABLE "messages" ADD COLUMN "sender_role" TEXT NOT NULL DEFAULT 'customer';

UPDATE "messages" AS m
SET "sender_role" = 'admin'
FROM "conversations" AS c
WHERE c."id" = m."conversation_id" AND m."sender_id" <> c."customer_id";

ALTER TABLE "messages" ALTER COLUMN "sender_id" DROP NOT NULL;

ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_role_check"
    CHECK ("sender_role" IN ('customer', 'admin', 'assistant'));

ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_role_matches_id_check"
    CHECK (
        ("sender_role" = 'assistant' AND "sender_id" IS NULL)
        OR ("sender_role" <> 'assistant' AND "sender_id" IS NOT NULL)
    );

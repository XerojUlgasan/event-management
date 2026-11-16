-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "claimed_guest_identity_id" UUID,
ADD COLUMN     "guest_customer_message_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "guest_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "guest_identity_id" UUID,
ALTER COLUMN "customer_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "guest_origin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "guest_chat_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_chat_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_message_requests" (
    "conversation_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "assistant_message_id" UUID,
    "assistant_error" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "guest_message_requests_pkey" PRIMARY KEY ("conversation_id","request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_chat_identities_token_hash_key" ON "guest_chat_identities"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "guest_message_requests_message_id_key" ON "guest_message_requests"("message_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_guest_identity_id_fkey" FOREIGN KEY ("guest_identity_id") REFERENCES "guest_chat_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_claimed_guest_identity_id_fkey" FOREIGN KEY ("claimed_guest_identity_id") REFERENCES "guest_chat_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_message_requests" ADD CONSTRAINT "guest_message_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Anonymous ownership is exclusive. Claiming clears the capability owner while
-- retaining its identity solely for idempotent authenticated claim retries.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_check" CHECK (
  ("customer_id" IS NOT NULL AND "guest_identity_id" IS NULL AND "guest_expires_at" IS NULL)
  OR ("customer_id" IS NULL AND "guest_identity_id" IS NOT NULL AND "guest_expires_at" IS NOT NULL AND "claimed_guest_identity_id" IS NULL AND "booking_request_id" IS NULL)
);
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_guest_count_check"
  CHECK ("guest_customer_message_count" BETWEEN 0 AND 5);
CREATE UNIQUE INDEX "conversations_active_guest_identity_key"
  ON "conversations" ("guest_identity_id") WHERE "guest_identity_id" IS NOT NULL AND "status" = 'active';
CREATE INDEX "conversations_claimed_guest_identity_idx" ON "conversations" ("claimed_guest_identity_id");

-- A guest customer message is still a human message, with explicit immutable
-- provenance. It must never masquerade as an assistant or a registered sender.
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_role_matches_id_check";
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_role_matches_id_check" CHECK (
  ("sender_role" = 'assistant' AND "sender_id" IS NULL AND NOT "guest_origin")
  OR ("sender_role" IN ('customer', 'admin') AND "sender_id" IS NOT NULL AND NOT "guest_origin")
  OR ("sender_role" = 'customer' AND "sender_id" IS NULL AND "guest_origin")
);

ALTER TABLE "guest_chat_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guest_message_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "guest_chat_identities", "guest_message_requests" FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON guest_chat_identities, guest_message_requests FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

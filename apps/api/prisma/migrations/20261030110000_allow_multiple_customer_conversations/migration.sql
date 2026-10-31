DROP INDEX IF EXISTS "conversations_customer_id_key";
CREATE INDEX IF NOT EXISTS "conversations_customer_id_created_at_idx"
    ON "conversations"("customer_id", "created_at");
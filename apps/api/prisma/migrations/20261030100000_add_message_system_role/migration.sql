ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_role_check";
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_role_check"
    CHECK ("sender_role" IN ('customer', 'admin', 'assistant', 'system'));

ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_role_matches_id_check";
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_role_matches_id_check"
    CHECK (
        ("sender_role" IN ('assistant', 'system') AND "sender_id" IS NULL)
        OR ("sender_role" IN ('customer', 'admin') AND "sender_id" IS NOT NULL)
    );
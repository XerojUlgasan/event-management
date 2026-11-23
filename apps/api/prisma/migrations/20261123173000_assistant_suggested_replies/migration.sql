ALTER TABLE "messages"
  ADD COLUMN "suggested_replies" JSONB,
  ADD CONSTRAINT "messages_assistant_suggested_replies_check" CHECK (
    "suggested_replies" IS NULL OR (
      "sender_role" = 'assistant' AND "quotation_id" IS NULL AND
      CASE WHEN jsonb_typeof("suggested_replies") = 'array'
        THEN jsonb_array_length("suggested_replies") <= 3
          AND NOT jsonb_path_exists("suggested_replies", '$[*] ? (@.type() != "string")')
        ELSE false
      END
    )
  );

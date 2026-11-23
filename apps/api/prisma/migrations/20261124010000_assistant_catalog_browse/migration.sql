ALTER TABLE "messages"
  ADD COLUMN "catalog_browse" JSONB,
  ADD CONSTRAINT "messages_assistant_catalog_browse_check" CHECK (
    "catalog_browse" IS NULL OR (
      "sender_role" = 'assistant' AND "quotation_id" IS NULL AND
      "catalog_browse" IN (
        '["packages"]'::jsonb,
        '["services"]'::jsonb,
        '["packages", "services"]'::jsonb
      )
    )
  );

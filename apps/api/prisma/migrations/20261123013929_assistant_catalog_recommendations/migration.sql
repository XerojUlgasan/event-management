-- AlterTable
ALTER TABLE "messages"
  ADD COLUMN "catalog_recommendations" JSONB,
  ADD CONSTRAINT "messages_assistant_catalog_recommendations_check" CHECK (
    "catalog_recommendations" IS NULL OR (
      "sender_role" = 'assistant' AND "quotation_id" IS NULL AND
      CASE WHEN jsonb_typeof("catalog_recommendations") = 'array'
        THEN jsonb_array_length("catalog_recommendations") BETWEEN 1 AND 3
        ELSE false
      END
    )
  );

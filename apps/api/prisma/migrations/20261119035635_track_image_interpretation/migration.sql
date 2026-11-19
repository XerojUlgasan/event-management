-- AlterTable
ALTER TABLE "ai_tool_calls" ADD COLUMN     "conversation_id" UUID,
ADD COLUMN     "source_message_id" UUID,
ALTER COLUMN "customer_message_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ai_tool_calls_conversation_id_idx" ON "ai_tool_calls"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_tool_calls_source_message_id_idx" ON "ai_tool_calls"("source_message_id");

-- AddForeignKey
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION public.validate_ai_tool_call_messages()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  customer_conversation_id UUID;
  message_conversation_id UUID;
BEGIN
  IF NEW.tool_name = 'interpretMessageImage' THEN
    IF NEW.conversation_id IS NULL OR NEW.customer_message_id IS NOT NULL OR NEW.assistant_message_id IS NOT NULL THEN
      RAISE EXCEPTION 'Image tool call requires only a conversation and optional source message' USING ERRCODE = '23514';
    END IF;
    IF NEW.source_message_id IS NOT NULL THEN
      SELECT conversation_id INTO message_conversation_id FROM public.messages
      WHERE id = NEW.source_message_id AND sender_role IN ('customer', 'admin');
      IF NOT FOUND OR message_conversation_id IS DISTINCT FROM NEW.conversation_id THEN
        RAISE EXCEPTION 'Image tool call source must be a human message in the same conversation' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSE
    IF NEW.conversation_id IS NOT NULL OR NEW.source_message_id IS NOT NULL THEN
      RAISE EXCEPTION 'Assistant tool call cannot have an image source' USING ERRCODE = '23514';
    END IF;
    SELECT conversation_id INTO customer_conversation_id FROM public.messages
    WHERE id = NEW.customer_message_id AND sender_role = 'customer';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'AI tool call requires a customer message' USING ERRCODE = '23514';
    END IF;
    IF NEW.assistant_message_id IS NOT NULL THEN
      SELECT conversation_id INTO message_conversation_id FROM public.messages
      WHERE id = NEW.assistant_message_id AND sender_role = 'assistant';
      IF NOT FOUND OR message_conversation_id IS DISTINCT FROM customer_conversation_id THEN
        RAISE EXCEPTION 'AI tool call reply must be an assistant message in the same conversation' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER ai_tool_calls_validate_messages ON public.ai_tool_calls;
CREATE TRIGGER ai_tool_calls_validate_messages
BEFORE INSERT OR UPDATE OF tool_name, conversation_id, source_message_id, customer_message_id, assistant_message_id
ON public.ai_tool_calls FOR EACH ROW EXECUTE FUNCTION public.validate_ai_tool_call_messages();

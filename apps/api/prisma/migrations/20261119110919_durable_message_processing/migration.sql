-- Replace the scope validator before dropping its referenced column.
DROP TRIGGER ai_tool_calls_validate_messages ON public.ai_tool_calls;

/*
  Warnings:

  - You are about to drop the column `conversation_id` on the `ai_tool_calls` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[reply_to_message_id]` on the table `messages` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "ai_tool_calls" DROP    CONSTRAINT "ai_tool_calls_conversation_id_fkey";

-- DropIndex
DROP INDEX "ai_tool_calls_conversation_id_idx";

-- AlterTable
ALTER TABLE "ai_tool_calls" DROP COLUMN "conversation_id";

-- AlterTable
ALTER TABLE "message_images" ALTER COLUMN "interpretation" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "reply_to_message_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "messages_reply_to_message_id_key" ON "messages"("reply_to_message_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;


-- Image audits now bind the saved human source. Its conversation is derived
-- through messages instead of copying the conversation identity onto the audit.
CREATE OR REPLACE FUNCTION public.validate_ai_tool_call_messages()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE customer_conversation_id UUID; message_conversation_id UUID;
BEGIN
  IF NEW.tool_name = 'interpretMessageImage' THEN
    IF NEW.source_message_id IS NULL OR NEW.customer_message_id IS NOT NULL OR NEW.assistant_message_id IS NOT NULL THEN
      RAISE EXCEPTION 'Image tool call requires only a saved human source' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.messages WHERE id = NEW.source_message_id AND sender_role IN ('customer', 'admin')) THEN
      RAISE EXCEPTION 'Image tool source must be a human message' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.source_message_id IS NOT NULL THEN
      RAISE EXCEPTION 'Assistant tool call cannot have an image source' USING ERRCODE = '23514';
    END IF;
    SELECT conversation_id INTO customer_conversation_id FROM public.messages WHERE id = NEW.customer_message_id AND sender_role = 'customer';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'AI tool call requires a customer message' USING ERRCODE = '23514';
    END IF;
    IF NEW.assistant_message_id IS NOT NULL THEN
      SELECT conversation_id INTO message_conversation_id FROM public.messages WHERE id = NEW.assistant_message_id AND sender_role = 'assistant';
      IF NOT FOUND OR message_conversation_id IS DISTINCT FROM customer_conversation_id THEN
        RAISE EXCEPTION 'AI tool call reply must be an assistant message in the same conversation' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ai_tool_calls_validate_messages
BEFORE INSERT OR UPDATE OF tool_name, source_message_id, customer_message_id, assistant_message_id
ON public.ai_tool_calls FOR EACH ROW EXECUTE FUNCTION public.validate_ai_tool_call_messages();

CREATE FUNCTION public.validate_message_reply() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.reply_to_message_id IS NOT NULL AND (
    NEW.sender_role <> 'assistant' OR NOT EXISTS (
      SELECT 1 FROM public.messages trigger WHERE trigger.id = NEW.reply_to_message_id
        AND trigger.sender_role = 'customer' AND trigger.conversation_id = NEW.conversation_id
    )
  ) THEN
    RAISE EXCEPTION 'Reply must reference a customer message in the same conversation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_validate_reply BEFORE INSERT OR UPDATE OF reply_to_message_id, sender_role, conversation_id
ON public.messages FOR EACH ROW EXECUTE FUNCTION public.validate_message_reply();

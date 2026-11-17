CREATE TABLE public.ai_tool_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL,
  tool_call_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  customer_message_id UUID NOT NULL,
  assistant_message_id UUID,
  status TEXT NOT NULL DEFAULT 'started',
  input JSONB NOT NULL,
  output JSONB,
  error_code TEXT,
  started_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ(6),

  CONSTRAINT ai_tool_calls_pkey PRIMARY KEY (id),
  CONSTRAINT ai_tool_calls_turn_id_tool_call_id_key UNIQUE (turn_id, tool_call_id),
  CONSTRAINT ai_tool_calls_tool_call_id_check CHECK (
    btrim(tool_call_id) <> '' AND char_length(tool_call_id) <= 256
  ),
  CONSTRAINT ai_tool_calls_tool_name_check CHECK (
    tool_name ~ '^[A-Za-z][A-Za-z0-9_]{0,127}$'
  ),
  CONSTRAINT ai_tool_calls_status_check CHECK (
    status IN ('started', 'succeeded', 'failed')
  ),
  CONSTRAINT ai_tool_calls_input_check CHECK (
    jsonb_typeof(input) = 'object' AND octet_length(input::text) <= 65536
  ),
  CONSTRAINT ai_tool_calls_output_size_check CHECK (
    output IS NULL OR octet_length(output::text) <= 65536
  ),
  CONSTRAINT ai_tool_calls_error_code_check CHECK (
    error_code IS NULL OR error_code ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'
  ),
  CONSTRAINT ai_tool_calls_state_check CHECK (
    (status = 'started' AND completed_at IS NULL AND error_code IS NULL AND output IS NULL)
    OR (status = 'succeeded' AND completed_at IS NOT NULL AND error_code IS NULL)
    OR (status = 'failed' AND completed_at IS NOT NULL AND output IS NULL)
  ),
  CONSTRAINT ai_tool_calls_completed_at_check CHECK (
    completed_at IS NULL OR completed_at >= started_at
  ),
  CONSTRAINT ai_tool_calls_customer_message_id_fkey FOREIGN KEY (customer_message_id)
    REFERENCES public.messages(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT ai_tool_calls_assistant_message_id_fkey FOREIGN KEY (assistant_message_id)
    REFERENCES public.messages(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX ai_tool_calls_customer_message_id_idx
  ON public.ai_tool_calls(customer_message_id);
CREATE INDEX ai_tool_calls_assistant_message_id_idx
  ON public.ai_tool_calls(assistant_message_id);

CREATE FUNCTION public.validate_ai_tool_call_messages()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  customer_conversation_id UUID;
  assistant_conversation_id UUID;
BEGIN
  SELECT conversation_id INTO customer_conversation_id
  FROM public.messages
  WHERE id = NEW.customer_message_id AND sender_role = 'customer';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI tool call requires a customer message'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.assistant_message_id IS NOT NULL THEN
    SELECT conversation_id INTO assistant_conversation_id
    FROM public.messages
    WHERE id = NEW.assistant_message_id AND sender_role = 'assistant';

    IF NOT FOUND OR assistant_conversation_id IS DISTINCT FROM customer_conversation_id THEN
      RAISE EXCEPTION 'AI tool call reply must be an assistant message in the same conversation'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_tool_calls_validate_messages
BEFORE INSERT OR UPDATE OF customer_message_id, assistant_message_id
ON public.ai_tool_calls
FOR EACH ROW
EXECUTE FUNCTION public.validate_ai_tool_call_messages();

ALTER TABLE public.ai_tool_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.ai_tool_calls FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.ai_tool_calls FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.validate_ai_tool_call_messages() FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION public.validate_ai_tool_call_messages() FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END $$;

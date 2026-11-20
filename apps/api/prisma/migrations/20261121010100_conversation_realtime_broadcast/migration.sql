-- Keep broadcasts transactional and allow message saves on plain PostgreSQL.
CREATE SCHEMA clemora_conversation_events;
REVOKE ALL ON SCHEMA clemora_conversation_events FROM PUBLIC;

CREATE FUNCTION clemora_conversation_events.broadcast_message_added(
  conversation_id uuid,
  event_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RETURN;
  END IF;

  PERFORM realtime.send(
    event_payload,
    'conversation_message_added',
    'conversation:' || conversation_id::text,
    true
  );
EXCEPTION WHEN OTHERS THEN
  -- The saved thread remains available through the regular API.
  RAISE WARNING 'Unable to broadcast conversation message (%).', SQLSTATE;
END;
$$;

REVOKE ALL ON FUNCTION clemora_conversation_events.broadcast_message_added(uuid, jsonb) FROM PUBLIC;

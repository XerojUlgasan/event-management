-- Realtime manages this table on Supabase. Compose and SQL replay may omit it.
DO $migration$
BEGIN
  IF to_regclass('realtime.messages') IS NULL
    OR to_regprocedure('realtime.topic()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RETURN;
  END IF;

  CREATE SCHEMA clemora_realtime_access;
  REVOKE ALL ON SCHEMA clemora_realtime_access FROM PUBLIC;

  CREATE FUNCTION clemora_realtime_access.can_receive_conversation(requested_topic text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $function$
  DECLARE
    claims jsonb := nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb;
    conversation_claim text := claims ->> 'conversation_id';
    session_claim text := claims ->> 'clemora_session_id';
    subject_claim text := claims ->> 'sub';
    uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  BEGIN
    IF claims ->> 'clemora_scope' IS DISTINCT FROM 'conversation_messages'
      OR claims ->> 'role' IS DISTINCT FROM 'authenticated'
      OR requested_topic IS DISTINCT FROM 'conversation:' || conversation_claim
      OR coalesce(conversation_claim, '') !~ uuid_pattern
      OR coalesce(session_claim, '') !~ uuid_pattern
      OR coalesce(subject_claim, '') !~ uuid_pattern THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.sessions AS session
      JOIN public.users AS viewer ON viewer.id = session.user_id
      JOIN public.conversations AS conversation ON conversation.id = conversation_claim::uuid
      WHERE session.id = session_claim::uuid
        AND session.user_id = subject_claim::uuid
        AND session.expires_at > now()
        AND conversation.customer_id IS NOT NULL
        AND conversation.guest_identity_id IS NULL
        AND (viewer.role = 'admin'
          OR (viewer.role = 'customer' AND conversation.customer_id = viewer.id))
    );
  END;
  $function$;

  REVOKE ALL ON FUNCTION clemora_realtime_access.can_receive_conversation(text) FROM PUBLIC;
  -- The stored policy references the function directly. Leave schema USAGE private
  -- so the authenticated role cannot look up or invoke the helper as an RPC.
  GRANT EXECUTE ON FUNCTION clemora_realtime_access.can_receive_conversation(text) TO authenticated;

  CREATE POLICY clemora_conversation_broadcast_receive
    ON realtime.messages FOR SELECT TO authenticated
    USING (extension = 'broadcast' AND topic LIKE 'conversation:%');

  -- Restrictive policies keep conversation topics bounded even if another
  -- Realtime policy grants broader powers for an unrelated feature.
  CREATE POLICY clemora_conversation_broadcast_read_scope
    ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
    USING (
      CASE WHEN topic LIKE 'conversation:%' OR (SELECT realtime.topic()) LIKE 'conversation:%'
        THEN extension = 'broadcast'
          AND topic = (SELECT realtime.topic())
          AND clemora_realtime_access.can_receive_conversation(topic)
        ELSE nullif(current_setting('request.jwt.claims', true), '')::jsonb
          ->> 'clemora_scope' IS DISTINCT FROM 'conversation_messages'
      END
    );

  CREATE POLICY clemora_conversation_broadcast_receive_only
    ON realtime.messages AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (
      coalesce(topic, '') NOT LIKE 'conversation:%'
      AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'conversation:%'
      AND nullif(current_setting('request.jwt.claims', true), '')::jsonb
        ->> 'clemora_scope' IS DISTINCT FROM 'conversation_messages'
    );

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE POLICY clemora_conversation_broadcast_deny_anon
      ON realtime.messages AS RESTRICTIVE FOR ALL TO anon
      USING (
        coalesce(topic, '') NOT LIKE 'conversation:%'
        AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'conversation:%'
      );
  END IF;
END;
$migration$;

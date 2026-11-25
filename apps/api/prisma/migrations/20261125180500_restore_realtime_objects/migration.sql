-- Restore the Realtime objects on databases that recorded the original
-- migrations but are missing their schema changes. Keep this atomic so readers
-- cannot see a partially restored set of permissive and restrictive policies.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $repair$
BEGIN
  -- Plain PostgreSQL deployments use the HTTP polling fallback.
  IF to_regclass('realtime.messages') IS NULL THEN
    RETURN;
  END IF;

  IF to_regprocedure('realtime.topic()') IS NULL
    OR to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'realtime.messages'::regclass)
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Supabase Realtime prerequisites are incomplete';
  END IF;

  CREATE SCHEMA IF NOT EXISTS clemora_realtime_access;
  REVOKE ALL ON SCHEMA clemora_realtime_access FROM PUBLIC;

  CREATE OR REPLACE FUNCTION clemora_realtime_access.can_receive_conversation(requested_topic text)
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

  DROP POLICY IF EXISTS clemora_conversation_broadcast_receive ON realtime.messages;
  CREATE POLICY clemora_conversation_broadcast_receive
    ON realtime.messages FOR SELECT TO authenticated
    USING (extension = 'broadcast' AND topic LIKE 'conversation:%');

  -- Restrictive policies keep conversation topics bounded even if another
  -- Realtime policy grants broader powers for an unrelated feature.
  DROP POLICY IF EXISTS clemora_conversation_broadcast_read_scope ON realtime.messages;
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

  DROP POLICY IF EXISTS clemora_conversation_broadcast_receive_only ON realtime.messages;
  CREATE POLICY clemora_conversation_broadcast_receive_only
    ON realtime.messages AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (
      coalesce(topic, '') NOT LIKE 'conversation:%'
      AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'conversation:%'
      AND nullif(current_setting('request.jwt.claims', true), '')::jsonb
        ->> 'clemora_scope' IS DISTINCT FROM 'conversation_messages'
    );

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    DROP POLICY IF EXISTS clemora_conversation_broadcast_deny_anon ON realtime.messages;
    CREATE POLICY clemora_conversation_broadcast_deny_anon
      ON realtime.messages AS RESTRICTIVE FOR ALL TO anon
      USING (
        coalesce(topic, '') NOT LIKE 'conversation:%'
        AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'conversation:%'
      );
  END IF;

  CREATE SCHEMA IF NOT EXISTS clemora_conversation_events;
  REVOKE ALL ON SCHEMA clemora_conversation_events FROM PUBLIC;

  CREATE OR REPLACE FUNCTION clemora_conversation_events.broadcast_message_added(
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

  CREATE OR REPLACE FUNCTION clemora_realtime_access.can_receive_notifications(requested_topic text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $function$
  DECLARE
    claims jsonb := nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb;
    session_claim text := claims ->> 'clemora_session_id';
    subject_claim text := claims ->> 'sub';
    uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  BEGIN
    IF claims ->> 'clemora_scope' IS DISTINCT FROM 'user_notifications'
      OR claims ->> 'role' IS DISTINCT FROM 'authenticated'
      OR requested_topic IS DISTINCT FROM 'notifications:' || subject_claim
      OR coalesce(session_claim, '') !~ uuid_pattern
      OR coalesce(subject_claim, '') !~ uuid_pattern THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.sessions AS session
      JOIN public.users AS recipient ON recipient.id = session.user_id
      WHERE session.id = session_claim::uuid
        AND session.user_id = subject_claim::uuid
        AND session.expires_at > now()
    );
  END;
  $function$;

  REVOKE ALL ON FUNCTION clemora_realtime_access.can_receive_notifications(text) FROM PUBLIC;
  -- Grant policy execution while keeping direct lookup through the schema private.
  GRANT EXECUTE ON FUNCTION clemora_realtime_access.can_receive_notifications(text) TO authenticated;

  DROP POLICY IF EXISTS clemora_notification_broadcast_receive ON realtime.messages;
  CREATE POLICY clemora_notification_broadcast_receive
    ON realtime.messages FOR SELECT TO authenticated
    USING (extension = 'broadcast' AND topic LIKE 'notifications:%');

  DROP POLICY IF EXISTS clemora_notification_broadcast_read_scope ON realtime.messages;
  CREATE POLICY clemora_notification_broadcast_read_scope
    ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
    USING (
      CASE WHEN topic LIKE 'notifications:%' OR (SELECT realtime.topic()) LIKE 'notifications:%'
        THEN extension = 'broadcast'
          AND topic = (SELECT realtime.topic())
          AND (SELECT clemora_realtime_access.can_receive_notifications(realtime.topic()))
        ELSE (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb)
          ->> 'clemora_scope' IS DISTINCT FROM 'user_notifications'
      END
    );

  DROP POLICY IF EXISTS clemora_notification_broadcast_receive_only ON realtime.messages;
  CREATE POLICY clemora_notification_broadcast_receive_only
    ON realtime.messages AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (
      coalesce(topic, '') NOT LIKE 'notifications:%'
      AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'notifications:%'
      AND (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb)
        ->> 'clemora_scope' IS DISTINCT FROM 'user_notifications'
    );

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    DROP POLICY IF EXISTS clemora_notification_broadcast_deny_anon ON realtime.messages;
    CREATE POLICY clemora_notification_broadcast_deny_anon
      ON realtime.messages AS RESTRICTIVE FOR ALL TO anon
      USING (
        coalesce(topic, '') NOT LIKE 'notifications:%'
        AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'notifications:%'
      );
  END IF;

  CREATE OR REPLACE FUNCTION clemora_realtime_access.broadcast_notification_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
  AS $function$
  BEGIN
    PERFORM realtime.send(
      '{"type":"notifications_changed"}'::jsonb,
      'notifications_changed',
      'notifications:' || NEW.recipient_user_id::text,
      true
    );

    RETURN NULL;
  EXCEPTION WHEN OTHERS THEN
    -- A Realtime failure must leave the stored notification available through HTTP.
    RAISE WARNING 'Unable to broadcast notification change (%).', SQLSTATE;
    RETURN NULL;
  END;
  $function$;

  REVOKE ALL ON FUNCTION clemora_realtime_access.broadcast_notification_change() FROM PUBLIC;

  DROP TRIGGER IF EXISTS notifications_broadcast_insert ON public.notifications;
  CREATE TRIGGER notifications_broadcast_insert
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION clemora_realtime_access.broadcast_notification_change();

  DROP TRIGGER IF EXISTS notifications_broadcast_read_change ON public.notifications;
  CREATE TRIGGER notifications_broadcast_read_change
    AFTER UPDATE ON public.notifications
    FOR EACH ROW WHEN (OLD.read_at IS DISTINCT FROM NEW.read_at)
    EXECUTE FUNCTION clemora_realtime_access.broadcast_notification_change();
END;
$repair$;

COMMIT;

-- Supabase owns realtime.messages. Plain PostgreSQL still serves notifications through HTTP.
DO $migration$
BEGIN
  IF to_regclass('realtime.messages') IS NULL
    OR to_regprocedure('realtime.topic()') IS NULL
    OR to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RETURN;
  END IF;

  CREATE SCHEMA IF NOT EXISTS clemora_realtime_access;
  REVOKE ALL ON SCHEMA clemora_realtime_access FROM PUBLIC;

  CREATE FUNCTION clemora_realtime_access.can_receive_notifications(requested_topic text)
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

  CREATE POLICY clemora_notification_broadcast_receive
    ON realtime.messages FOR SELECT TO authenticated
    USING (extension = 'broadcast' AND topic LIKE 'notifications:%');

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

  CREATE POLICY clemora_notification_broadcast_receive_only
    ON realtime.messages AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (
      coalesce(topic, '') NOT LIKE 'notifications:%'
      AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'notifications:%'
      AND (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb)
        ->> 'clemora_scope' IS DISTINCT FROM 'user_notifications'
    );

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE POLICY clemora_notification_broadcast_deny_anon
      ON realtime.messages AS RESTRICTIVE FOR ALL TO anon
      USING (
        coalesce(topic, '') NOT LIKE 'notifications:%'
        AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'notifications:%'
      );
  END IF;

  CREATE FUNCTION clemora_realtime_access.broadcast_notification_change()
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

  CREATE TRIGGER notifications_broadcast_insert
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION clemora_realtime_access.broadcast_notification_change();

  CREATE TRIGGER notifications_broadcast_read_change
    AFTER UPDATE ON public.notifications
    FOR EACH ROW WHEN (OLD.read_at IS DISTINCT FROM NEW.read_at)
    EXECUTE FUNCTION clemora_realtime_access.broadcast_notification_change();
END;
$migration$;

-- Prisma resets public. Remove Realtime objects outside public before replaying migrations.
DO $reset$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS clemora_conversation_broadcast_receive ON realtime.messages;
    DROP POLICY IF EXISTS clemora_conversation_broadcast_read_scope ON realtime.messages;
    DROP POLICY IF EXISTS clemora_conversation_broadcast_receive_only ON realtime.messages;
    DROP POLICY IF EXISTS clemora_conversation_broadcast_deny_anon ON realtime.messages;
    DROP POLICY IF EXISTS clemora_notification_broadcast_receive ON realtime.messages;
    DROP POLICY IF EXISTS clemora_notification_broadcast_read_scope ON realtime.messages;
    DROP POLICY IF EXISTS clemora_notification_broadcast_receive_only ON realtime.messages;
    DROP POLICY IF EXISTS clemora_notification_broadcast_deny_anon ON realtime.messages;
    DROP POLICY IF EXISTS amac_conversation_broadcast_receive ON realtime.messages;
    DROP POLICY IF EXISTS amac_conversation_broadcast_read_scope ON realtime.messages;
    DROP POLICY IF EXISTS amac_conversation_broadcast_receive_only ON realtime.messages;
    DROP POLICY IF EXISTS amac_conversation_broadcast_deny_anon ON realtime.messages;
    DROP POLICY IF EXISTS amac_notification_broadcast_receive ON realtime.messages;
    DROP POLICY IF EXISTS amac_notification_broadcast_read_scope ON realtime.messages;
    DROP POLICY IF EXISTS amac_notification_broadcast_receive_only ON realtime.messages;
    DROP POLICY IF EXISTS amac_notification_broadcast_deny_anon ON realtime.messages;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notifications_broadcast_insert ON public.notifications;
    DROP TRIGGER IF EXISTS notifications_broadcast_read_change ON public.notifications;
  END IF;

  DROP FUNCTION IF EXISTS clemora_realtime_access.can_receive_conversation(text);
  DROP FUNCTION IF EXISTS clemora_realtime_access.can_receive_notifications(text);
  DROP FUNCTION IF EXISTS clemora_realtime_access.broadcast_notification_change();
  DROP FUNCTION IF EXISTS clemora_conversation_events.broadcast_message_added(uuid, jsonb);
  DROP SCHEMA IF EXISTS clemora_realtime_access;
  DROP SCHEMA IF EXISTS clemora_conversation_events;
  DROP FUNCTION IF EXISTS amac_realtime_access.can_receive_conversation(text);
  DROP FUNCTION IF EXISTS amac_realtime_access.can_receive_notifications(text);
  DROP FUNCTION IF EXISTS amac_realtime_access.broadcast_notification_change();
  DROP FUNCTION IF EXISTS amac_conversation_events.broadcast_message_added(uuid, jsonb);
  DROP SCHEMA IF EXISTS amac_realtime_access;
  DROP SCHEMA IF EXISTS amac_conversation_events;
END;
$reset$;

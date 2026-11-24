-- Prisma resets public. Remove Clemora's Realtime objects that live outside it
-- so the existing migrations can recreate them on the next replay.
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
  END IF;

  DROP SCHEMA IF EXISTS clemora_realtime_access, clemora_conversation_events CASCADE;
END;
$reset$;

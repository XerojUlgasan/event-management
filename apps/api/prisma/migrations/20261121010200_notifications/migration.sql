CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type text NOT NULL CONSTRAINT notifications_type_check CHECK (type IN (
    'booking_request_created', 'booking_status_updated', 'quotation_sent', 'human_review_requested'
  )),
  source_event_id uuid NOT NULL,
  payload jsonb NOT NULL CONSTRAINT notifications_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  read_at timestamptz(6),
  CONSTRAINT notifications_recipient_source_event_key UNIQUE (recipient_user_id, type, source_event_id)
);

CREATE INDEX notifications_recipient_created_at_id_idx
  ON public.notifications (recipient_user_id, created_at DESC, id DESC);

CREATE INDEX notifications_recipient_unread_idx
  ON public.notifications (recipient_user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM PUBLIC;

DO $$
DECLARE
  client_role text;
BEGIN
  FOR client_role IN
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM %I', client_role);
  END LOOP;
END;
$$;

BEGIN;

ALTER TABLE public.messages
  ADD COLUMN booking_review jsonb,
  ADD COLUMN booking_review_reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT messages_booking_review_check CHECK (
    booking_review IS NULL OR (sender_role = 'assistant' AND jsonb_typeof(booking_review) = 'object')
  ),
  ADD CONSTRAINT messages_booking_review_reply_check CHECK (
    booking_review_reply_to IS NULL OR (sender_role = 'customer' AND sender_id IS NOT NULL)
  );

ALTER TABLE public.booking_requests
  ADD COLUMN intake_details jsonb,
  ADD CONSTRAINT booking_requests_intake_details_check CHECK (
    intake_details IS NULL OR jsonb_typeof(intake_details) = 'object'
  );

CREATE TABLE public.conversation_booking_drafts (
  conversation_id uuid PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'awaiting_confirmation', 'submitted', 'discarded')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  review_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  review_ai_version integer,
  last_customer_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

ALTER TABLE public.conversation_booking_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_booking_drafts FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.conversation_booking_drafts FROM %I', client_role);
    END IF;
  END LOOP;
END $$;

COMMIT;

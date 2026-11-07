CREATE TABLE booking_arrangements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL UNIQUE REFERENCES booking_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  estimated_duration TEXT NOT NULL DEFAULT 'undecided',
  estimated_duration_days INTEGER,
  starts_at TIMESTAMPTZ(6),
  ends_at TIMESTAMPTZ(6),
  time_zone TEXT NOT NULL,
  guest_count INTEGER,
  preferred_venue_location TEXT,
  notes TEXT,
  updated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT booking_arrangements_guest_count_check CHECK (guest_count > 0),
  CONSTRAINT booking_arrangements_duration_days_check CHECK (estimated_duration_days IS NULL OR estimated_duration_days >= 8),
  CONSTRAINT booking_arrangements_time_order_check CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX booking_arrangements_updated_by_idx ON booking_arrangements(updated_by);

INSERT INTO booking_arrangements (
  booking_request_id,
  event_type,
  preferred_date,
  estimated_duration,
  estimated_duration_days,
  starts_at,
  ends_at,
  time_zone,
  guest_count,
  preferred_venue_location,
  notes,
  updated_by,
  created_at,
  updated_at
)
SELECT
  id,
  event_type,
  preferred_date,
  estimated_duration,
  estimated_duration_days,
  starts_at,
  ends_at,
  time_zone,
  guest_count,
  preferred_venue_location,
  NULL,
  customer_id,
  created_at,
  updated_at
FROM booking_requests;

CREATE TABLE customization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  decision_reason TEXT,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT customization_requests_type_check CHECK (
    type IN (
      'add_inclusions',
      'remove_inclusions',
      'substitute_inclusions',
      'modify_inclusions',
      'adjust_quantities',
      'add_event_hours',
      'change_venue',
      'special_requirements'
    )
  ),
  CONSTRAINT customization_requests_status_check CHECK (status IN ('requested', 'approved', 'rejected', 'withdrawn')),
  CONSTRAINT customization_requests_description_check CHECK (length(btrim(description)) BETWEEN 1 AND 4000),
  CONSTRAINT customization_requests_decision_reason_check CHECK (decision_reason IS NULL OR length(decision_reason) <= 1000),
  CONSTRAINT customization_requests_decision_state_check CHECK (
    (status = 'requested' AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
    OR (status IN ('approved', 'rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
    OR (status = 'withdrawn' AND decided_by IS NULL AND decided_at IS NULL)
  )
);

CREATE INDEX customization_requests_booking_idx ON customization_requests(booking_request_id, created_at);
CREATE INDEX customization_requests_status_idx ON customization_requests(status, created_at);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at);

-- Add invitation fields to event_checklists.
-- These are 1:1 with a booking request (same unique constraint already enforced).
ALTER TABLE event_checklists
  ADD COLUMN response_deadline DATE,
  ADD COLUMN team_published    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN staff_description TEXT    CHECK (char_length(staff_description) <= 1000);

-- event_staff_assignments: combines availability response + team selection in one row.
-- A row is inserted when admin adds a staff member to an event's invite list.
-- staff fills in `response`; admin sets `selected_at` when finalising the team.
CREATE TABLE event_staff_assignments (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID        NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  staff_id           UUID        NOT NULL REFERENCES users(id)            ON DELETE CASCADE ON UPDATE NO ACTION,
  response           TEXT        CHECK (response IN ('available', 'unavailable')),  -- NULL = not answered
  selected_at        TIMESTAMPTZ(6),  -- set by admin; NULL = not selected
  created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT event_staff_assignments_booking_staff_unique
    UNIQUE (booking_request_id, staff_id)
);

CREATE INDEX event_staff_assignments_booking_request_id_idx ON event_staff_assignments(booking_request_id);
CREATE INDEX event_staff_assignments_staff_id_idx           ON event_staff_assignments(staff_id);

-- event_checklists: one checklist per confirmed booking request, assigned to a coordinator.
CREATE TABLE event_checklists (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID        NOT NULL REFERENCES booking_requests(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  coordinator_id     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT event_checklists_booking_request_id_key UNIQUE (booking_request_id)
);

CREATE INDEX event_checklists_coordinator_id_idx ON event_checklists(coordinator_id);

-- event_checklist_items: individual activity items within a checklist.
CREATE TABLE event_checklist_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID        NOT NULL REFERENCES event_checklists(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  stage        TEXT        NOT NULL CHECK (stage IN (
                             'Preparation & packing',
                             'Travel & arrival',
                             'Venue setup',
                             'Final readiness',
                             'Event proper',
                             'Cleanup & closeout'
                           )),
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  activity     TEXT        NOT NULL CHECK (char_length(activity) <= 200),
  planned_time TEXT,
  status       TEXT        NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'blocked')),
  actual_time  TEXT,
  blocker_note TEXT        CHECK (char_length(blocker_note) <= 400),
  notes        TEXT        CHECK (char_length(notes) <= 400),
  photo_count  INTEGER     NOT NULL DEFAULT 0 CHECK (photo_count >= 0),
  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX event_checklist_items_checklist_id_stage_sort_order_idx
  ON event_checklist_items(checklist_id, stage, sort_order);

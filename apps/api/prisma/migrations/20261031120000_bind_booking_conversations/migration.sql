ALTER TABLE conversations
  ADD COLUMN booking_request_id UUID;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_booking_request_id_fkey
  FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX conversations_booking_request_id_key
  ON conversations(booking_request_id)
  WHERE booking_request_id IS NOT NULL;
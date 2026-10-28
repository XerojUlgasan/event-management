CREATE TABLE booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reference TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  package_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE RESTRICT,
  package_name TEXT NOT NULL, event_type TEXT NOT NULL, starts_at TIMESTAMPTZ(6) NOT NULL,
  ends_at TIMESTAMPTZ(6) NOT NULL, time_zone TEXT NOT NULL, guest_count INTEGER NOT NULL CHECK (guest_count > 0),
  contact_name TEXT NOT NULL, phone_number TEXT NOT NULL, preferred_venue_location TEXT NOT NULL,
  special_requests TEXT, status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review','needs_details','accepted','declined','cancelled')),
  out_of_range BOOLEAN NOT NULL, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK (ends_at > starts_at)
);
CREATE INDEX booking_requests_customer_id_created_at_idx ON booking_requests(customer_id, created_at);
CREATE TABLE booking_request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_request_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('under_review','needs_details','accepted','declined','cancelled')),
  reason TEXT, changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX booking_request_status_history_booking_request_id_created_at_idx ON booking_request_status_history(booking_request_id, created_at);

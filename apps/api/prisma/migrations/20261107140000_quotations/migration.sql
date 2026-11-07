CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  currency TEXT NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP'),
  base_amount_minor INTEGER NOT NULL CHECK (base_amount_minor > 0),
  total_amount_minor INTEGER NOT NULL CHECK (total_amount_minor >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'superseded')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ(6),
  accepted_at TIMESTAMPTZ(6),
  superseded_at TIMESTAMPTZ(6),
  UNIQUE (booking_request_id, version)
);

CREATE UNIQUE INDEX quotations_one_sent_per_booking ON quotations(booking_request_id) WHERE status = 'sent';
CREATE UNIQUE INDEX quotations_one_accepted_per_booking ON quotations(booking_request_id) WHERE status = 'accepted';
CREATE INDEX quotations_booking_status_idx ON quotations(booking_request_id, status);

CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('add', 'deduct')),
  kind TEXT NOT NULL CHECK (kind IN ('addition', 'deduction', 'substitution', 'adjustment')),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 4000),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  customization_request_id UUID REFERENCES customization_requests(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  UNIQUE (quotation_id, sort_order)
);

CREATE INDEX quotation_items_service_idx ON quotation_items(service_id);
CREATE INDEX quotation_items_customization_idx ON quotation_items(customization_request_id);
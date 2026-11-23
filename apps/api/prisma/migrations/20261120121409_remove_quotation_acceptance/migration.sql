-- Retire quotation acceptance; customer feedback is recorded through chat.
-- Existing financial versions, delivery messages and audit events stay intact.
-- Acceptance timestamps are deliberately discarded. Booking acceptance is separate.
BEGIN;

ALTER TABLE quotations
  DROP CONSTRAINT quotations_status_check,
  DROP CONSTRAINT quotations_final_total_check,
  DROP COLUMN accepted_at,
  ADD CONSTRAINT quotations_status_check CHECK (status IN ('draft', 'sent', 'superseded')),
  ADD CONSTRAINT quotations_final_total_check CHECK (status <> 'sent' OR total_amount_minor >= 0);

DROP INDEX quotations_one_accepted_per_booking;

COMMIT;

-- NULL marks historical requests whose complete date list was never collected.
ALTER TABLE "booking_requests" ADD COLUMN "requested_days" JSONB;
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requested_days_array"
  CHECK (requested_days IS NULL OR (jsonb_typeof(requested_days) = 'array' AND jsonb_array_length(requested_days) > 0));

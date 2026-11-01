-- Preserve historical guest counts; new inquiries can leave the estimate unknown.
ALTER TABLE booking_requests ALTER COLUMN guest_count DROP NOT NULL;

ALTER TABLE booking_requests
  DROP CONSTRAINT booking_requests_estimated_duration_check,
  ADD CONSTRAINT booking_requests_estimated_duration_check
    CHECK (estimated_duration IN (
      '4_hours', '8_hours', '12_hours', '1_day', '2_days',
      '3_days', '4_days', '5_days', '6_days', '1_week',
      'more_than_1_week', 'undecided'
    ));

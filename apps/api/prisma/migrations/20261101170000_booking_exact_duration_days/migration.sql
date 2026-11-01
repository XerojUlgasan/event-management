ALTER TABLE booking_requests
  ADD COLUMN estimated_duration_days INTEGER,
  ADD CONSTRAINT booking_requests_estimated_duration_days_check
    CHECK (
      estimated_duration_days IS NULL OR
      (estimated_duration = 'more_than_1_week' AND estimated_duration_days >= 8)
    );

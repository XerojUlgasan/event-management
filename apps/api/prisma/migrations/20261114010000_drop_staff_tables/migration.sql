-- Drop staff assignment and availability tables
DROP TABLE IF EXISTS "event_staffs";
DROP TABLE IF EXISTS "event_staff_availability";

-- Remove staffing columns from events_day
ALTER TABLE "events_day" DROP COLUMN IF EXISTS "staffing_status";
ALTER TABLE "events_day" DROP COLUMN IF EXISTS "availability_deadline";

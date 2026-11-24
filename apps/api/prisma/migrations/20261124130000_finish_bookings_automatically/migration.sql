BEGIN;

ALTER TABLE "booking_requests"
  DROP CONSTRAINT "booking_requests_status_check",
  ADD CONSTRAINT "booking_requests_status_check"
    CHECK ("status" IN ('under_review', 'needs_details', 'accepted', 'finished', 'declined', 'cancelled'));

ALTER TABLE "booking_request_status_history"
  ALTER COLUMN "changed_by" DROP NOT NULL,
  DROP CONSTRAINT "booking_request_status_history_status_check",
  ADD CONSTRAINT "booking_request_status_history_status_check"
    CHECK ("status" IN ('under_review', 'needs_details', 'accepted', 'finished', 'declined', 'cancelled')
      AND ("changed_by" IS NOT NULL OR "status" = 'finished'));

-- Preserve earlier manual completions in the existing status history.
INSERT INTO "booking_request_status_history" ("booking_request_id", "status", "changed_by", "created_at")
SELECT "id", 'finished', "event_finished_by", "event_finished_at"
FROM "booking_requests"
WHERE "event_finished_at" IS NOT NULL;

UPDATE "booking_requests"
SET "status" = 'finished', "updated_at" = GREATEST("updated_at", "event_finished_at")
WHERE "event_finished_at" IS NOT NULL;

DROP INDEX "booking_requests_pending_event_completion_idx";

ALTER TABLE "booking_requests"
  DROP CONSTRAINT "booking_requests_event_completion_check",
  DROP COLUMN "event_finished_at",
  DROP COLUMN "event_finished_by",
  DROP COLUMN "event_ready_at";

CREATE INDEX "booking_requests_pending_event_completion_idx"
  ON "booking_requests" ("id")
  WHERE "submitted_at" IS NOT NULL AND "status" = 'accepted';

COMMIT;

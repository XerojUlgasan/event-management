-- AlterTable
ALTER TABLE "booking_requests" ADD COLUMN     "event_finished_at" TIMESTAMPTZ(6),
ADD COLUMN     "event_finished_by" UUID,
ADD COLUMN     "event_ready_at" TIMESTAMPTZ(6);

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_event_finished_by_fkey" FOREIGN KEY ("event_finished_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_event_completion_check" CHECK (
  ("event_ready_at" IS NULL OR ("submitted_at" IS NOT NULL AND "status" NOT IN ('declined', 'cancelled')))
  AND (("event_finished_at" IS NULL) = ("event_finished_by" IS NULL))
  AND ("event_finished_at" IS NULL OR ("event_ready_at" IS NOT NULL AND "event_finished_at" >= "event_ready_at"))
);

CREATE INDEX "booking_requests_pending_event_completion_idx"
  ON "booking_requests" ("id")
  WHERE "submitted_at" IS NOT NULL AND "event_ready_at" IS NULL AND "event_finished_at" IS NULL;

ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("type" IN (
  'booking_request_created', 'booking_status_updated', 'quotation_sent', 'human_review_requested',
  'event_ready_to_finish', 'event_finished'
));

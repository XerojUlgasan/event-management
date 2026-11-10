BEGIN;

-- Additive database foundation only. The API will later own availability
-- deadlines, staff eligibility, overlap checks, local-day validation against
-- the booking timezone, and transactional cancellation/movement of assignments.
-- No existing bookings or staff are backfilled into these tables.

-- CreateTable
CREATE TABLE "events_day" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_request_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "staffing_status" TEXT NOT NULL DEFAULT 'draft',
    "availability_deadline" TIMESTAMPTZ(6),
    "replacement_event_day_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_staff_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_day_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "response" TEXT NOT NULL,
    "responded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_staff_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_staffs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_day_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_staffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_day_booking_request_id_day_idx" ON "events_day"("booking_request_id", "day");

-- CreateIndex
CREATE INDEX "events_day_replacement_event_day_id_booking_request_id_idx" ON "events_day"("replacement_event_day_id", "booking_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_day_id_booking_request_id_key" ON "events_day"("id", "booking_request_id");

-- CreateIndex
CREATE INDEX "event_staff_availability_staff_id_idx" ON "event_staff_availability"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_staff_availability_event_day_id_staff_id_key" ON "event_staff_availability"("event_day_id", "staff_id");

-- CreateIndex
CREATE INDEX "event_staffs_staff_id_status_idx" ON "event_staffs"("staff_id", "status");

-- CreateIndex
CREATE INDEX "event_staffs_assigned_by_idx" ON "event_staffs"("assigned_by");

-- CreateIndex
CREATE UNIQUE INDEX "event_staffs_event_day_id_staff_id_key" ON "event_staffs"("event_day_id", "staff_id");

-- AddForeignKey
ALTER TABLE "events_day" ADD CONSTRAINT "events_day_booking_request_id_fkey" FOREIGN KEY ("booking_request_id") REFERENCES "booking_requests"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "events_day" ADD CONSTRAINT "events_day_replacement_same_booking_fkey" FOREIGN KEY ("replacement_event_day_id", "booking_request_id") REFERENCES "events_day"("id", "booking_request_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_staff_availability" ADD CONSTRAINT "event_staff_availability_event_day_id_fkey" FOREIGN KEY ("event_day_id") REFERENCES "events_day"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_staff_availability" ADD CONSTRAINT "event_staff_availability_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_staffs" ADD CONSTRAINT "event_staffs_event_day_id_fkey" FOREIGN KEY ("event_day_id") REFERENCES "events_day"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_staffs" ADD CONSTRAINT "event_staffs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "event_staffs" ADD CONSTRAINT "event_staffs_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Match existing status storage: TEXT columns with database CHECK constraints.
ALTER TABLE "events_day"
    ADD CONSTRAINT "events_day_time_range_check" CHECK ("ends_at" > "starts_at"),
    ADD CONSTRAINT "events_day_status_check" CHECK ("status" IN ('scheduled', 'cancelled', 'moved')),
    ADD CONSTRAINT "events_day_staffing_status_check" CHECK ("staffing_status" IN ('draft', 'open', 'closed')),
    ADD CONSTRAINT "events_day_open_deadline_check" CHECK ("staffing_status" <> 'open' OR "availability_deadline" IS NOT NULL),
    ADD CONSTRAINT "events_day_inactive_staffing_check" CHECK ("status" = 'scheduled' OR "staffing_status" = 'closed'),
    ADD CONSTRAINT "events_day_replacement_status_check" CHECK (("status" = 'moved') = ("replacement_event_day_id" IS NOT NULL)),
    ADD CONSTRAINT "events_day_replacement_not_self_check" CHECK ("replacement_event_day_id" IS NULL OR "replacement_event_day_id" <> "id");

ALTER TABLE "event_staff_availability"
    ADD CONSTRAINT "event_staff_availability_response_check" CHECK ("response" IN ('available', 'unavailable'));

ALTER TABLE "event_staffs"
    ADD CONSTRAINT "event_staffs_role_check" CHECK ("role" IN ('coordinator', 'helper')),
    ADD CONSTRAINT "event_staffs_status_check" CHECK ("status" IN ('confirmed', 'cancelled'));

-- Cancelled coordinator assignments stay in history and do not occupy the role.
-- Prisma cannot express this conditional uniqueness in the current schema.
CREATE UNIQUE INDEX "event_staffs_one_confirmed_coordinator_per_day_idx"
    ON "event_staffs"("event_day_id")
    WHERE "role" = 'coordinator' AND "status" = 'confirmed';

-- Match 20261109140000_enable_application_rls for these newly created tables.
-- The owning server role retains access; direct clients have no policies/grants.
DO $$
DECLARE
    target_table text;
    client_role text;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['events_day', 'event_staff_availability', 'event_staffs'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', target_table);
        FOR client_role IN
            SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
        LOOP
            EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', target_table, client_role);
        END LOOP;
    END LOOP;
END;
$$;

COMMIT;

import type { Kysely, Selectable, Transaction } from "kysely";
import type {
  BookingRequests,
  DB,
  EventsDay,
  EventStaffAvailability,
  EventStaffs,
} from "../../db/types.js";

export type Database = Kysely<DB> | Transaction<DB>;
export type DayRow = Pick<
  Selectable<EventsDay>,
  | "id"
  | "booking_request_id"
  | "starts_at"
  | "ends_at"
  | "status"
  | "staffing_status"
  | "availability_deadline"
  | "replacement_event_day_id"
> &
  Pick<Selectable<BookingRequests>, "event_type" | "time_zone"> & {
    booking_reference: string;
    package_name: string;
    day: string;
    booking_status: string;
  };
export type AvailabilityRow = Pick<
  Selectable<EventStaffAvailability>,
  "event_day_id" | "staff_id" | "response" | "responded_at"
> & { staff_name: string };
export type AssignmentRow = Pick<
  Selectable<EventStaffs>,
  "event_day_id" | "staff_id" | "role" | "status" | "assigned_at"
> & { staff_name: string };

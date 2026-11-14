import type { Kysely, Selectable, Transaction } from "kysely";
import type { BookingRequests, DB, EventsDay } from "../../db/types.js";

export type Database = Kysely<DB> | Transaction<DB>;
export type DayRow = Pick<
  Selectable<EventsDay>,
  | "id"
  | "booking_request_id"
  | "starts_at"
  | "ends_at"
  | "status"
  | "replacement_event_day_id"
> &
  Pick<Selectable<BookingRequests>, "event_type" | "time_zone"> & {
    booking_reference: string;
    package_name: string;
    day: string;
    booking_status: string;
  };

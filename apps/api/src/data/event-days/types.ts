import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, EventsDay } from "../../db/types.js";

export type Database = Kysely<DB> | Transaction<DB>;

export type DayRow = Pick<
  Selectable<EventsDay>,
  | "id"
  | "booking_request_id"
  | "starts_at"
  | "ends_at"
  | "status"
  | "replacement_event_day_id"
> & {
  event_type: string;
  time_zone: string;
  booking_reference: string;
  package_name: string | null;
  day: string;
  booking_status: string;
};

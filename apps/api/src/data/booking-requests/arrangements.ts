import type { Insertable, Kysely, Selectable, Transaction, Updateable } from "kysely";
import type { BookingArrangements, DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export type ArrangementRow = Selectable<BookingArrangements> & {
  updated_by_name: string | null;
};

export function listArrangementsData(
  db: Database,
  bookingIds: string[],
): Promise<ArrangementRow[]> {
  if (!bookingIds.length) return Promise.resolve([]);
  return db
    .selectFrom("booking_arrangements as ba")
    .innerJoin("users as editor", "editor.id", "ba.updated_by")
    .selectAll("ba")
    .select([
      "editor.display_name as updated_by_name",
    ])
    .where("ba.booking_request_id", "in", bookingIds)
    .execute();
}

export function findArrangementForUpdateData(
  db: Transaction<DB>,
  bookingId: string,
) {
  return db
    .selectFrom("booking_arrangements")
    .selectAll()
    .where("booking_request_id", "=", bookingId)
    .forUpdate()
    .executeTakeFirst();
}

export function createArrangementData(
  db: Transaction<DB>,
  values: Insertable<BookingArrangements>,
) {
  return db
    .insertInto("booking_arrangements")
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function updateArrangementData(
  db: Transaction<DB>,
  bookingId: string,
  values: Updateable<BookingArrangements>,
) {
  return db
    .updateTable("booking_arrangements")
    .set(values)
    .where("booking_request_id", "=", bookingId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
export const packageColumns = (content: Content) => ({
  name: content.name,
  ...(content.description !== undefined ? { description: content.description } : {}),
  event_types: content.eventTypes,
  guest_max: content.guestMax,
  price: content.price.amountMinor / 100,
});
export function createPackageData(
  db: Transaction<DB>,
  content: Content,
  now: Date,
) {
  return db
    .insertInto("packages")
    .values({
      ...packageColumns(content),
      created_at: now,
      updated_at: now,
      published_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

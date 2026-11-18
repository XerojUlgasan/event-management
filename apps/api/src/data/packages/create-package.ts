import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
export const packageColumns = (content: Content, slug: string) => ({
  name: content.name.trim(),
  slug,
  ...(content.description !== undefined
    ? { description: content.description }
    : {}),
  max_guests: content.maxGuests,
  price: content.price.amountMinor / 100,
  ...(content.thumbnailMediaId !== undefined
    ? { thumbnail_media_id: content.thumbnailMediaId ?? null }
    : {}),
  ...(content.eventType !== undefined
    ? { event_type: content.eventType ?? null }
    : {}),
});
export function createPackageData(
  db: Transaction<DB>,
  content: Content,
  slug: string,
  now: Date,
) {
  return db
    .insertInto("packages")
    .values({
      ...packageColumns(content, slug),
      created_at: now,
      updated_at: now,
      published_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

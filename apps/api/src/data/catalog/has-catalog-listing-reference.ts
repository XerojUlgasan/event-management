import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function hasCatalogListingReferenceData(
  db: Kysely<DB> | Transaction<DB>,
  listing: { kind: "package" | "service"; id: string },
) {
  const field = listing.kind === "package" ? "packageId" : "serviceId";
  const ref = sql<boolean>`canvas @> jsonb_build_array(jsonb_build_object('widgets', jsonb_build_array(jsonb_build_object(${sql.lit(field)}, ${listing.id}::text))))`;

  const [packageRef, serviceRef, bookingRef] = await Promise.all([
    db.selectFrom("packages").select("id").where(ref).executeTakeFirst(),
    db.selectFrom("services").select("id").where(ref).executeTakeFirst(),
    listing.kind === "service"
      ? db
          .selectFrom("booking_requests")
          .select("id")
          .where("submitted_at", "is not", null)
          .where(
            sql<boolean>`requested_services @> jsonb_build_array(jsonb_build_object('serviceId', ${listing.id.toLowerCase()}::text))`,
          )
          .where(
            sql<boolean>`exists (select 1 from jsonb_array_elements(requested_services) as item where item->>'serviceId' = ${listing.id.toLowerCase()} and jsonb_typeof(item->'offer') = 'object')`,
          )
          .executeTakeFirst()
      : Promise.resolve(undefined),
  ]);

  return Boolean(packageRef || serviceRef || bookingRef);
}

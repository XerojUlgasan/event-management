import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function hasCatalogListingReferenceData(
  db: Kysely<DB> | Transaction<DB>,
  listing: { kind: "package" | "service"; id: string },
) {
  const field = listing.kind === "package" ? "packageId" : "serviceId";
  const ref = sql<boolean>`canvas @> jsonb_build_array(jsonb_build_object('widgets', jsonb_build_array(jsonb_build_object(${sql.lit(field)}, ${listing.id}::text))))`;
  const [packageRef, serviceRef] = await Promise.all([
    db.selectFrom("packages").select("id").where(ref).executeTakeFirst(),
    db.selectFrom("services").select("id").where(ref).executeTakeFirst(),
  ]);
  return Boolean(packageRef || serviceRef);
}

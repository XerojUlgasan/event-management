import { sql } from "kysely";
import type {
  Database,
  CanvasOwner,
} from "../catalog-canvas/catalog-canvas-types.js";
import { canvasContainsMedia } from "./canvas-reference.js";

export async function findMediaOwnersData(db: Database, id: string) {
  const packages = await db
    .selectFrom("packages as p")
    .select(["p.id", "p.package_type", "p.custom_for_booking_request_id"])
    .where((eb) =>
      eb.or([
        canvasContainsMedia(sql.ref("p.canvas"), sql`${id}`),
        eb("p.thumbnail_media_id", "=", id),
      ]),
    )
    .execute();
  const services = await db
    .selectFrom("services as s")
    .select("s.id")
    .where((eb) =>
      eb.or([
        canvasContainsMedia(sql.ref("s.canvas"), sql`${id}`),
        eb("s.thumbnail_media_id", "=", id),
      ]),
    )
    .execute();
  return { packages, services };
}

export async function listOwnerMediaIdsData(db: Database, owner: CanvasOwner) {
  const table = owner.kind === "package" ? "packages" : "services";
  const result = await sql<{ id: string }>`
    SELECT m.id FROM media_assets m
    JOIN ${sql.table(table)} o ON o.id = ${owner.id}::uuid
    WHERE m.source = 'upload' AND (
      ${canvasContainsMedia(sql.ref("o.canvas"), sql.ref("m.id"))}
      OR o.thumbnail_media_id = m.id
    ) ORDER BY m.id
  `.execute(db);
  return result.rows.map((row) => row.id);
}

export async function updateMediaStorageKeyData(
  db: Database,
  id: string,
  key: string,
) {
  await db
    .updateTable("media_assets")
    .set({ storage_key: key })
    .where("id", "=", id)
    .execute();
}

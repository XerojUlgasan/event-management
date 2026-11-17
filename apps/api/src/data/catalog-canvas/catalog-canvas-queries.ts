import { sql, type Transaction } from "kysely";
import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import type { DB } from "../../db/types.js";
import { canvasContainsMedia } from "../catalog-media/canvas-reference.js";
import type { CanvasOwner, Database } from "./catalog-canvas-types.js";

export async function readStoredCanvasData(db: Database, owner: CanvasOwner) {
  const table = owner.kind === "package" ? "packages" : "services";
  const row = await db
    .selectFrom(table)
    .select("canvas")
    .where("id", "=", owner.id)
    .executeTakeFirst();
  return row ? storedSectionsSchema.parse(row.canvas) : [];
}

export const listCanvasPackagesData = (db: Database, ids: string[]) =>
  ids.length
    ? db
        .selectFrom("packages")
        .select(["id", "slug", "name", "description", "canvas"])
        .where("id", "in", ids)
        .where("package_type", "=", "catalog")
        .where("archived_at", "is", null)
        .execute()
    : Promise.resolve([]);
export const listCanvasServicesData = (db: Database, ids: string[]) =>
  ids.length
    ? db
        .selectFrom("services")
        .select(["id", "slug", "name", "description", "canvas"])
        .where("id", "in", ids)
        .where("archived_at", "is", null)
        .execute()
    : Promise.resolve([]);
export const listCanvasAssetsData = (db: Database, ids: string[]) =>
  ids.length
    ? db.selectFrom("media_assets").selectAll().where("id", "in", ids).execute()
    : Promise.resolve([]);
export const lockCanvasServiceData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("services")
    .select(["id", "archived_at"])
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
export const lockCanvasPackageData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("packages")
    .select(["id", "archived_at", "package_type"])
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
export async function findCanvasMediaOwnersData(
  db: Transaction<DB>,
  id: string,
) {
  const ref = sql`${id}`;
  const packageRefs = await db
    .selectFrom("packages as p")
    .select("p.id")
    .where(canvasContainsMedia(sql.ref("p.canvas"), ref))
    .execute();
  const serviceRefs = await db
    .selectFrom("services as s")
    .select("s.id")
    .where(canvasContainsMedia(sql.ref("s.canvas"), ref))
    .execute();
  return { packageRefs, serviceRefs };
}
export async function updateStoredCanvasData(
  db: Transaction<DB>,
  owner: CanvasOwner,
  sections: unknown,
) {
  const table = owner.kind === "package" ? "packages" : "services";
  await db
    .updateTable(table)
    .set({ canvas: sql`${JSON.stringify(sections)}::jsonb` })
    .where("id", "=", owner.id)
    .executeTakeFirstOrThrow();
}

import type { PackageAddonService } from "@event-management/contracts/catalog";
import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const updateCustomPackageAddonsData = (
  db: Transaction<DB>,
  id: string,
  addons: PackageAddonService[],
  updatedAt: Date,
) =>
  db
    .updateTable("packages")
    .set({
      addon_services: sql`${JSON.stringify(addons)}::jsonb`,
      updated_at: updatedAt,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

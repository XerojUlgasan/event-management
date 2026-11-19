import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { packageColumns } from "../packages/create-package.js";

export const createCustomPackageData = (
  db: Transaction<DB>,
  bookingId: string,
  content: Content,
  now: Date,
  slug: string,
) =>
  db
    .insertInto("packages")
    .values({
      ...packageColumns(content, slug),
      package_type: "custom",
      custom_for_booking_request_id: bookingId,
      published_at: null,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

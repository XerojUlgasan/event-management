import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { packageColumns } from "../packages/create-package.js";
import type { Database } from "../packages/catalog-page.js";

export const findCurrentBookingPackageData = (db: Database, id: string) => db.selectFrom("packages").selectAll().where("id", "=", id).executeTakeFirst();
export const lockCurrentBookingPackageData = (db: Transaction<DB>, id: string) => db.selectFrom("packages").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
export const createCustomPackageData = (db: Transaction<DB>, bookingId: string, content: Content, now: Date) => db.insertInto("packages").values({ ...packageColumns(content), package_type: "custom", custom_for_booking_request_id: bookingId, published_at: null, created_at: now, updated_at: now }).returningAll().executeTakeFirstOrThrow();

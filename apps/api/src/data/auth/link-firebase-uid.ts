import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function linkFirebaseUidData(
  db: Kysely<DB>,
  userId: string,
  uid: string,
) {
  return db
    .transaction()
    .execute(async (trx) => {
      await trx
        .selectFrom("users")
        .select("id")
        .where("id", "=", userId)
        .forUpdate()
        .execute();
      const owner = await trx
        .selectFrom("users")
        .select("id")
        .where("firebase_uid", "=", uid)
        .executeTakeFirst();
      if (owner && owner.id !== userId) return undefined;
      return trx
        .updateTable("users")
        .set({ firebase_uid: uid, updated_at: new Date() })
        .where("id", "=", userId)
        .where("firebase_uid", "is", null)
        .returningAll()
        .executeTakeFirst();
    })
    .catch((error: unknown) => {
      // The unique Firebase UID also protects against links racing across users.
      if ((error as { code?: string }).code === "23505") return undefined;
      throw error;
    });
}

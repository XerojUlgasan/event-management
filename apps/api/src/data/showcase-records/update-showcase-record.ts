import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const updateShowcaseRecordData = (
  db: Transaction<DB>,
  id: string,
  values: {
    title: string;
    description: string;
    cover_media_id: string;
    preview_video_id: string | null;
    updated_at: Date;
  },
) =>
  db
    .updateTable("showcase_records")
    .set(values)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { MessageImageInterpretation } from "@event-management/contracts/message-images";

export type SavedMessageImage = {
  id: string;
  position: number;
  storage_key: string;
  mime_type: string;
  byte_size: number;
  content_hash: string;
  interpretation: MessageImageInterpretation | null;
};

export const messageImagesSelection = (alias = "m") =>
  sql<
    SavedMessageImage[]
  >`coalesce((select json_agg(mi order by mi.position) from message_images mi where mi.message_id = ${sql.ref(`${alias}.id`)}), '[]'::json)`.as(
    "images",
  );

export async function listMessageImagesData(db: Kysely<DB>, messageId: string) {
  return db
    .selectFrom("message_images")
    .selectAll()
    .where("message_id", "=", messageId)
    .orderBy("position")
    .execute();
}

export async function insertMessageImagesData(
  db: Transaction<DB>,
  messageId: string,
  conversationId: string,
  images: SavedMessageImage[],
) {
  if (images.length)
    await db
      .insertInto("message_images")
      .values(
        images.map((image) => ({
          ...image,
          message_id: messageId,
          interpretation: image.interpretation
            ? JSON.stringify(image.interpretation)
            : null,
        })),
      )
      .execute();
}

export async function matchingMessageImagesData(
  db: Kysely<DB>,
  messageId: string,
  hashes: string[],
) {
  const images = await listMessageImagesData(db, messageId);

  return (
    images.length === hashes.length &&
    images.every((image, index) => image.content_hash === hashes[index])
  );
}

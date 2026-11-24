import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { selectDeliveredCatalogToolCallsData } from "./select-delivered-catalog-tool-calls.js";

export function listLatestDeliveredPhotoSearchesData(
  db: Kysely<DB>,
  scope: { conversationId: string; customerMessageId: string },
  attachmentIds: string[],
) {
  const photoId = sql<string>`tool_call.input ->> 'photoAttachmentId'`;
  const catalogType = sql<string>`tool_call.input ->> 'catalogType'`;

  return selectDeliveredCatalogToolCallsData(db, {
    ...scope,
    toolName: "searchPublicCatalog",
  })
    .where(photoId, "in", attachmentIds)
    .distinctOn([photoId, catalogType])
    .orderBy(photoId)
    .orderBy(catalogType)
    .orderBy("trigger_message.created_at", "desc")
    .orderBy("trigger_message.id", "desc")
    .orderBy("tool_call.started_at", "desc")
    .orderBy("tool_call.id", "desc")
    .execute();
}

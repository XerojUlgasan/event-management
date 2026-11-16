import type { Database } from "./catalog-knowledge-types.js";

export function findCatalogKnowledgeMediaData(db: Database, mediaId: string) {
  return db
    .selectFrom("media_assets")
    .selectAll()
    .where("id", "=", mediaId)
    .executeTakeFirst();
}

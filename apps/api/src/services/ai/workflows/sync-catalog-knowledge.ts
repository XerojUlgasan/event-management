import type { Transaction } from "kysely";
import type { DB } from "../../../db/types.js";
import { findCatalogKnowledgeMediaData } from "../../../data/ai/find-catalog-knowledge-media.js";
import { loadCatalogKnowledgeSourceData } from "../../../data/ai/load-catalog-knowledge-source.js";
import { lockCatalogKnowledgeOwnerData } from "../../../data/ai/lock-catalog-knowledge-owner.js";
import { reconcileCatalogKnowledgeData } from "../../../data/ai/reconcile-catalog-knowledge.js";
import type { CatalogKnowledgeOwner } from "../../../data/ai/catalog-knowledge-types.js";
import { prepareCatalogKnowledge } from "./prepare-catalog-knowledge.js";
import { catalogKnowledgeSourceHash } from "../catalog-knowledge-hash.js";

export async function syncCatalogKnowledge(
  trx: Transaction<DB>,
  owner: CatalogKnowledgeOwner,
) {
  await lockCatalogKnowledgeOwnerData(trx, owner);
  const source = await loadCatalogKnowledgeSourceData(trx, owner);
  const prepared = source ? prepareCatalogKnowledge(source) : [];
  const chunks = [];
  for (const chunk of prepared) {
    const media = chunk.mediaId
      ? await findCatalogKnowledgeMediaData(trx, chunk.mediaId)
      : undefined;
    if (chunk.mediaId && !media)
      throw new Error("Catalog photo is unavailable");
    const sourceHash = catalogKnowledgeSourceHash(chunk.contentMarkdown, media);
    chunks.push({ ...chunk, sourceHash });
  }
  return reconcileCatalogKnowledgeData(trx, owner, chunks);
}

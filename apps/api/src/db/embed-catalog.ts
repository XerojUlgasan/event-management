import "dotenv/config";
import { db } from "./client.js";
import { config } from "../env.js";
import { listCatalogKnowledgeOwnersData } from "../data/ai/list-catalog-knowledge-owners.js";
import { pruneIneligibleCatalogKnowledgeData } from "../data/ai/prune-ineligible-catalog-knowledge.js";
import { refreshCatalogEmbeddingsService } from "../services/ai/workflows/refresh-catalog-embeddings.js";

const controller = new AbortController();

const stop = () => controller.abort();

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  if (config.EMBEDDING_MODEL !== "google/gemini-embedding-2")
    throw new Error("Catalog embedding requires google/gemini-embedding-2");

  await pruneIneligibleCatalogKnowledgeData(db);
  const owners = await listCatalogKnowledgeOwnersData(db);
  const total = {
    owners: owners.length,
    embedded: 0,
    unchanged: 0,
    superseded: 0,
    failed: 0,
  };

  for (const owner of owners) {
    controller.signal.throwIfAborted();

    try {
      const result = await refreshCatalogEmbeddingsService({
        db,
        owner,
        abortSignal: controller.signal,
      });

      for (const field of [
        "embedded",
        "unchanged",
        "superseded",
        "failed",
      ] as const)
        total[field] += result[field];
    } catch {
      total.failed++;
      console.warn("catalog-embedding", {
        ownerKind: owner.kind,
        ownerId: owner.id,
        outcome: "pending",
      });
    }
  }

  console.info("catalog-embedding-backfill", total);

  if (total.failed) process.exitCode = 1;
} catch {
  console.error(
    "Catalog embedding backfill failed. Check database migrations, embedding configuration, and Storage access.",
  );
  process.exitCode = 1;
} finally {
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
  await db.destroy();
}

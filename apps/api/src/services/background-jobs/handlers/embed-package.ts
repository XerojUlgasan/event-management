import type { Kysely } from "kysely";
import type { DB } from "../../../db/types.js";
import { refreshCatalogEmbeddingsService } from "../../ai/workflows/refresh-catalog-embeddings.js";

export async function embedPackageJob(
  db: Kysely<DB>,
  payload: { packageId: string },
  signal: AbortSignal,
) {
  const result = await refreshCatalogEmbeddingsService({
    db,
    owner: { kind: "package", id: payload.packageId },
    abortSignal: signal,
  });
  if (result.failed > 0) throw new Error("Embedding refresh failed");
}

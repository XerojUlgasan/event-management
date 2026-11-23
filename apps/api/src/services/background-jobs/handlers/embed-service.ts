import type { Kysely } from "kysely";
import type { DB } from "../../../db/types.js";
import { refreshCatalogEmbeddingsService } from "../../ai/workflows/refresh-catalog-embeddings.js";

export async function embedServiceJob(
  db: Kysely<DB>,
  payload: { serviceId: string },
  signal: AbortSignal,
) {
  const result = await refreshCatalogEmbeddingsService({
    db,
    owner: { kind: "service", id: payload.serviceId },
    abortSignal: signal,
  });

  if (result.failed > 0) throw new Error("Embedding refresh failed");
}

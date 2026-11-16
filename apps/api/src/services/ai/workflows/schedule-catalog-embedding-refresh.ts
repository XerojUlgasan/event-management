import type { Kysely } from "kysely";
import type { DB } from "../../../db/types.js";
import type { CatalogKnowledgeOwner } from "../../../data/ai/catalog-knowledge-types.js";
import { env } from "../../../utils/env.js";
import { refreshCatalogEmbeddingsService } from "./refresh-catalog-embeddings.js";

// Coalesce repeated saves in one process. Persistent pending rows survive a restart;
// the backfill command reconciles sources and resumes incomplete embeddings.
const running = new WeakMap<
  Kysely<DB>,
  Map<string, { again: boolean; task: Promise<void> }>
>();
let active = 0;
const waiting: Array<() => void> = [];

async function acquireRefreshSlot() {
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
}

function releaseRefreshSlot() {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

export function scheduleCatalogEmbeddingRefresh(
  db: Kysely<DB>,
  owners: CatalogKnowledgeOwner[],
) {
  try {
    if (env.AI_EMBEDDING.model !== "google/gemini-embedding-2")
      throw new Error("Unsupported embedding model");
  } catch {
    if (owners.length)
      console.warn("catalog-embedding", {
        outcome: "pending",
        reason: "configuration",
      });
    return;
  }
  let jobs = running.get(db);
  if (!jobs) {
    jobs = new Map();
    running.set(db, jobs);
  }
  const tasks: Promise<void>[] = [];
  // Local oneshot workers terminate after the response, even with waitUntil.
  // Bound the whole batch while that runtime waits for it in the request.
  const requestSignal = env.CATALOG_EMBEDDING_AWAIT
    ? AbortSignal.timeout(110_000)
    : undefined;
  for (const owner of owners) {
    const key = `${owner.kind}:${owner.id}`;
    const existing = jobs.get(key);
    if (existing) {
      existing.again = true;
      tasks.push(existing.task);
      continue;
    }
    const job = { again: false, task: Promise.resolve() };
    jobs.set(key, job);
    job.task = (async () => {
      await acquireRefreshSlot();
      try {
        do {
          job.again = false;
          await refreshCatalogEmbeddingsService({
            db,
            owner,
            abortSignal: requestSignal ?? AbortSignal.timeout(120_000),
          });
        } while (job.again);
      } catch {
        console.warn("catalog-embedding", {
          ownerKind: owner.kind,
          ownerId: owner.id,
          outcome: "pending",
        });
      } finally {
        jobs.delete(key);
        releaseRefreshSlot();
      }
    })();
    tasks.push(job.task);
    {
      const runtime: unknown = Reflect.get(globalThis, "EdgeRuntime");
      if (
        runtime &&
        (typeof runtime === "object" || typeof runtime === "function") &&
        "waitUntil" in runtime &&
        typeof runtime.waitUntil === "function"
      )
        runtime.waitUntil(job.task);
    }
  }
  return env.CATALOG_EMBEDDING_AWAIT
    ? Promise.all(tasks).then(() => {})
    : undefined;
}

export async function waitForCatalogEmbeddingRefresh(db: Kysely<DB>) {
  for (;;) {
    const jobs = running.get(db);
    if (!jobs?.size) return;
    await Promise.all([...jobs.values()].map((job) => job.task));
  }
}

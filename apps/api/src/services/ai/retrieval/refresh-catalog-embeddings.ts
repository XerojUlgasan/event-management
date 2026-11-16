import type { Kysely } from "kysely";
import { APICallError } from "ai";
import type { DB } from "../../../db/types.js";
import {
  findCatalogKnowledgeMediaData,
  saveCatalogKnowledgeEmbeddingData,
  setCatalogKnowledgeInputHashData,
  type CatalogKnowledgeOwner,
} from "../../../data/ai/catalog-knowledge.js";
import { env } from "../../../utils/env.js";
import { embedCatalogContent } from "./embed-catalog-content.js";
import { readCatalogEmbeddingImage } from "./read-catalog-embedding-image.js";
import {
  catalogKnowledgeDigest,
  syncCatalogKnowledge,
} from "./sync-catalog-knowledge.js";

export async function refreshCatalogEmbeddingsService({
  db,
  owner,
  abortSignal,
}: {
  db: Kysely<DB>;
  owner: CatalogKnowledgeOwner;
  abortSignal?: AbortSignal;
}) {
  const rows = await db
    .transaction()
    .execute((trx) => syncCatalogKnowledge(trx, owner));
  const result = { embedded: 0, unchanged: 0, superseded: 0, failed: 0 };
  if (!rows.length) return result;
  const { model } = env.AI_EMBEDDING;
  if (model !== "google/gemini-embedding-2")
    throw new Error("Unsupported embedding model");
  for (const row of rows) {
    abortSignal?.throwIfAborted();
    try {
      const sourceHash = row.content_hash.split(":").slice(0, 2).join(":");
      const photoSignal = AbortSignal.timeout(30_000);
      const signal = abortSignal
        ? AbortSignal.any([photoSignal, abortSignal])
        : photoSignal;
      const media = row.media_id
        ? await findCatalogKnowledgeMediaData(db, row.media_id)
        : undefined;
      if (row.media_id && !media)
        throw new Error("Catalog photo is unavailable");
      const image = media
        ? await readCatalogEmbeddingImage(media, signal)
        : undefined;
      const inputHash = `${sourceHash}:${catalogKnowledgeDigest(image ? image.bytes : row.content_markdown)}`;
      const stage = await db.transaction().execute(async (trx) => {
        const current = (await syncCatalogKnowledge(trx, owner)).find(
          (item) => item.id === row.id,
        );
        if (!current || !current.content_hash.startsWith(sourceHash))
          return "superseded";
        if (
          current.content_hash === inputHash &&
          current.embedding &&
          current.embedding_model === model
        )
          return "unchanged";
        return (await setCatalogKnowledgeInputHashData(
          trx,
          row.id,
          current.content_hash,
          inputHash,
        ))
          ? "pending"
          : "superseded";
      });
      if (stage !== "pending") {
        result[stage]++;
        continue;
      }
      const vector = await embedCatalogContent({
        contentMarkdown: row.content_markdown,
        image,
        abortSignal,
      });
      abortSignal?.throwIfAborted();
      const saved = await db.transaction().execute(async (trx) => {
        const current = (await syncCatalogKnowledge(trx, owner)).find(
          (item) => item.id === row.id,
        );
        if (!current || current.content_hash !== inputHash) return false;
        return saveCatalogKnowledgeEmbeddingData(
          trx,
          row.id,
          inputHash,
          vector,
        );
      });
      result[saved ? "embedded" : "superseded"]++;
    } catch (cause) {
      abortSignal?.throwIfAborted();
      result.failed++;
      // Retain pending content for retry. Never log provider payloads or source text.
      console.warn("catalog-embedding", {
        ownerKind: owner.kind,
        ownerId: owner.id,
        chunkId: row.id,
        outcome: "failed",
        statusCode: APICallError.isInstance(cause)
          ? cause.statusCode
          : undefined,
      });
    }
  }
  return result;
}

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

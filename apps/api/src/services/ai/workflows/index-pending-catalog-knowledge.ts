import type { KnowledgeIndexResponse } from "@event-management/contracts/catalog-knowledge";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../../db/types.js";
import { ensureBackgroundJobScheduledService } from "../../background-jobs/enqueue-job.js";
import { lockCatalogKnowledgeOwnerData } from "../../../data/ai/lock-catalog-knowledge-owner.js";
import { loadCatalogKnowledge } from "../load-catalog-knowledge.js";

function isFatalDatabaseError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return true;

  const code = error.code;

  // Owner-specific constraint, transaction and lock failures can be retried.
  // Treat connection, schema and unexpected failures as a fatal pass.
  return (
    typeof code !== "string" ||
    !/^(23|40|55)[0-9A-Z]{3}$|^P0001$|^57014$/.test(code)
  );
}

export async function indexPendingCatalogKnowledgeService(
  db: Kysely<DB>,
  abortSignal: AbortSignal,
): Promise<KnowledgeIndexResponse> {
  abortSignal.throwIfAborted();

  const owners = await db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      await sql`SET LOCAL statement_timeout = '10s'`.execute(trx);
      const { entries } = await loadCatalogKnowledge(trx);
      abortSignal.throwIfAborted();

      return entries
        .map(({ listing }) => listing)
        .filter((listing) => listing.status !== "indexed")
        .map(({ kind, id }) => ({ kind, id }))
        .sort(
          (a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
        );
    });

  let submittedListings = 0;
  let skippedListings = 0;
  let failedListings = 0;

  for (const owner of owners) {
    abortSignal.throwIfAborted();

    try {
      const result = await db.transaction().execute(async (trx) => {
        await sql`SET LOCAL statement_timeout = '10s'`.execute(trx);
        await sql`SET LOCAL lock_timeout = '5s'`.execute(trx);
        abortSignal.throwIfAborted();
        const locked = await lockCatalogKnowledgeOwnerData(trx, owner);

        if (!locked) return "skipped";

        const { entries } = await loadCatalogKnowledge(trx, owner);

        if (!entries.length || entries[0]?.listing.status === "indexed")
          return "skipped";

        const outcome =
          owner.kind === "package"
            ? await ensureBackgroundJobScheduledService(trx, "embed_package", {
                packageId: owner.id,
              })
            : await ensureBackgroundJobScheduledService(trx, "embed_service", {
                serviceId: owner.id,
              });

        abortSignal.throwIfAborted();

        return outcome === "inserted" ? "submitted" : "skipped";
      });

      if (result === "submitted") submittedListings++;
      else skippedListings++;
    } catch (error) {
      abortSignal.throwIfAborted();

      if (isFatalDatabaseError(error)) throw error;

      failedListings++;
    }
  }

  abortSignal.throwIfAborted();

  return {
    pendingListings: owners.length,
    submittedListings,
    skippedListings,
    failedListings,
  };
}

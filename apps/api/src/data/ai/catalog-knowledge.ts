import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { readCatalogSectionsData } from "../packages/catalog-canvas.js";
import { listPackageServicesData } from "../packages/package-services.js";

type Database = Kysely<DB> | Transaction<DB>;
export type CatalogKnowledgeOwner = {
  kind: "package" | "service";
  id: string;
};

export async function lockCatalogKnowledgeOwnerData(
  trx: Transaction<DB>,
  owner: CatalogKnowledgeOwner,
) {
  const table = owner.kind === "package" ? "packages" : "services";
  const row = await trx
    .selectFrom(table)
    .select("id")
    .where("id", "=", owner.id)
    .forUpdate()
    .executeTakeFirst();
  if (!row) return false;
  if (owner.kind === "package") {
    await trx
      .selectFrom("services")
      .select("services.id")
      .where(
        "services.id",
        "in",
        trx
          .selectFrom("package_services")
          .select("service_id")
          .where("package_id", "=", owner.id),
      )
      .orderBy("services.id")
      .forUpdate()
      .execute();
  }
  return true;
}

export async function loadCatalogKnowledgeSourceData(
  db: Database,
  owner: CatalogKnowledgeOwner,
) {
  if (owner.kind === "package") {
    const record = await db
      .selectFrom("packages")
      .selectAll()
      .where("id", "=", owner.id)
      .where("package_type", "=", "catalog")
      .where("archived_at", "is", null)
      .executeTakeFirst();
    if (!record) return null;
    const sections = await readCatalogSectionsData(db, owner);
    const services = (await listPackageServicesData(db, [owner.id])).filter(
      (service) => !service.archived_at,
    );
    return { kind: "package" as const, record, sections, services };
  }
  const record = await db
    .selectFrom("services")
    .selectAll()
    .where("id", "=", owner.id)
    .where("archived_at", "is", null)
    .executeTakeFirst();
  if (!record) return null;
  return {
    kind: "service" as const,
    record,
    sections: await readCatalogSectionsData(db, owner),
    services: [],
  };
}

export function listCatalogKnowledgeData(
  db: Database,
  owner: CatalogKnowledgeOwner,
) {
  return db
    .selectFrom("catalog_knowledge")
    .selectAll()
    .where(
      owner.kind === "package" ? "package_id" : "service_id",
      "=",
      owner.id,
    )
    .orderBy("chunk_key")
    .execute();
}

export const listCatalogKnowledgeRowsData = listCatalogKnowledgeData;

export function findCatalogKnowledgeMediaData(db: Database, mediaId: string) {
  return db
    .selectFrom("media_assets")
    .selectAll()
    .where("id", "=", mediaId)
    .executeTakeFirst();
}

export async function reconcileCatalogKnowledgeData(
  trx: Transaction<DB>,
  owner: CatalogKnowledgeOwner,
  chunks: Array<{
    chunkKey: string;
    contentMarkdown: string;
    mediaId: string | null;
    sourceHash: string;
  }>,
) {
  const current = await listCatalogKnowledgeData(trx, owner);
  const byKey = new Map(current.map((row) => [row.chunk_key, row]));
  const desiredKeys = new Set(chunks.map((chunk) => chunk.chunkKey));
  const removed = current.filter((row) => !desiredKeys.has(row.chunk_key));
  if (removed.length)
    await trx
      .deleteFrom("catalog_knowledge")
      .where(
        "id",
        "in",
        removed.map((row) => row.id),
      )
      .execute();
  for (const chunk of chunks) {
    const previous = byKey.get(chunk.chunkKey);
    if (
      previous &&
      (previous.content_hash === chunk.sourceHash ||
        previous.content_hash.startsWith(`${chunk.sourceHash}:`))
    ) {
      if (previous.media_id !== chunk.mediaId)
        await trx
          .updateTable("catalog_knowledge")
          .set({ media_id: chunk.mediaId })
          .where("id", "=", previous.id)
          .execute();
      continue;
    }
    // Replacing the row also invalidates unfinished workers after A -> B -> A edits.
    if (previous)
      await trx
        .deleteFrom("catalog_knowledge")
        .where("id", "=", previous.id)
        .execute();
    await trx
      .insertInto("catalog_knowledge")
      .values({
        package_id: owner.kind === "package" ? owner.id : null,
        service_id: owner.kind === "service" ? owner.id : null,
        chunk_key: chunk.chunkKey,
        content_markdown: chunk.contentMarkdown,
        media_id: chunk.mediaId,
        content_hash: chunk.sourceHash,
        embedding: null,
        embedding_model: null,
        embedded_at: null,
      })
      .execute();
  }
  return listCatalogKnowledgeData(trx, owner);
}

export async function setCatalogKnowledgeInputHashData(
  db: Database,
  id: string,
  expectedHash: string,
  inputHash: string,
) {
  const result = await db
    .updateTable("catalog_knowledge")
    .set({
      content_hash: inputHash,
      embedding: null,
      embedding_model: null,
      embedded_at: null,
    })
    .where("id", "=", id)
    .where("content_hash", "=", expectedHash)
    .executeTakeFirst();
  return result.numUpdatedRows === 1n;
}

export async function saveCatalogKnowledgeEmbeddingData(
  db: Database,
  id: string,
  expectedHash: string,
  value: { embedding: number[]; model: string },
) {
  // pgvector may already be installed outside public, as on Supabase.
  const extension = await sql<{ schema: string }>`
    select n.nspname as schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector'
  `.execute(db);
  const schema = extension.rows[0]?.schema;
  if (!schema) throw new Error("Catalog knowledge requires pgvector");
  const result = await db
    .updateTable("catalog_knowledge")
    .set({
      embedding: sql<string>`cast(${JSON.stringify(value.embedding)} as ${sql.id(schema, "vector")})`,
      embedding_model: value.model,
      embedded_at: new Date(),
    })
    .where("id", "=", id)
    .where("content_hash", "=", expectedHash)
    .executeTakeFirst();
  return result.numUpdatedRows === 1n;
}

export function deleteCatalogKnowledgeData(
  trx: Transaction<DB>,
  owner: CatalogKnowledgeOwner,
) {
  return trx
    .deleteFrom("catalog_knowledge")
    .where(
      owner.kind === "package" ? "package_id" : "service_id",
      "=",
      owner.id,
    )
    .execute();
}

export async function invalidateDependentPackageKnowledgeData(
  trx: Transaction<DB>,
  serviceId: string,
): Promise<CatalogKnowledgeOwner[]> {
  const packages = await trx
    .selectFrom("package_services as ps")
    .innerJoin("packages as p", "p.id", "ps.package_id")
    .select("p.id")
    .where("ps.service_id", "=", serviceId)
    .where("p.package_type", "=", "catalog")
    .where("p.archived_at", "is", null)
    .orderBy("p.id")
    .execute();
  // Do not lock package owners here: package saves lock package -> services.
  for (const row of packages) {
    await trx
      .deleteFrom("catalog_knowledge")
      .where("package_id", "=", row.id)
      .where((eb) =>
        eb.or([
          eb("chunk_key", "=", "overview"),
          eb("chunk_key", "like", "overview:%"),
        ]),
      )
      .execute();
  }
  return packages.map((row) => ({ kind: "package", id: row.id }));
}

export async function listCatalogKnowledgeOwnersData(
  db: Database,
): Promise<CatalogKnowledgeOwner[]> {
  const packages = await db
    .selectFrom("packages")
    .select("id")
    .where("package_type", "=", "catalog")
    .where("archived_at", "is", null)
    .orderBy("id")
    .execute();
  const services = await db
    .selectFrom("services")
    .select("id")
    .where("archived_at", "is", null)
    .orderBy("id")
    .execute();
  return [
    ...packages.map((row) => ({ kind: "package" as const, id: row.id })),
    ...services.map((row) => ({ kind: "service" as const, id: row.id })),
  ];
}

export function pruneIneligibleCatalogKnowledgeData(db: Database) {
  return db
    .deleteFrom("catalog_knowledge")
    .where((eb) =>
      eb.or([
        eb.and([
          eb("package_id", "is not", null),
          eb.not(
            eb.exists(
              eb
                .selectFrom("packages as p")
                .select("p.id")
                .whereRef("p.id", "=", "catalog_knowledge.package_id")
                .where("p.package_type", "=", "catalog")
                .where("p.archived_at", "is", null),
            ),
          ),
        ]),
        eb.and([
          eb("service_id", "is not", null),
          eb.not(
            eb.exists(
              eb
                .selectFrom("services as s")
                .select("s.id")
                .whereRef("s.id", "=", "catalog_knowledge.service_id")
                .where("s.archived_at", "is", null),
            ),
          ),
        ]),
      ]),
    )
    .execute();
}

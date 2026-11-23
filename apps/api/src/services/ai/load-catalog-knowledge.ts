import type { KnowledgeSummary } from "@event-management/contracts/catalog-knowledge";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { loadKnowledgeSourcesData } from "../../data/ai/load-knowledge-sources.js";
import { prepareCatalogKnowledge } from "./workflows/prepare-catalog-knowledge.js";
import { assessKnowledgeListing } from "./catalog-knowledge-status.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function loadCatalogKnowledge(
  db: Database,
  owner?: { kind: "package" | "service"; id: string },
) {
  const { packages, services, assetMap, rowsByOwner, sections } =
    await loadKnowledgeSourcesData(db, owner);

  const entries = [
    ...packages.map((record) => {
      const owner = {
        id: record.id,
        name: record.name,
        kind: "package" as const,
      };

      return assessKnowledgeListing(
        owner,
        prepareCatalogKnowledge({
          kind: "package",
          record,
          sections: sections(record.canvas),
        }),
        rowsByOwner.get(`package:${record.id}`) ?? [],
        assetMap,
      );
    }),
    ...services.map((record) => {
      const owner = {
        id: record.id,
        name: record.name,
        kind: "service" as const,
      };

      return assessKnowledgeListing(
        owner,
        prepareCatalogKnowledge({
          kind: "service",
          record,
          sections: sections(record.canvas),
        }),
        rowsByOwner.get(`service:${record.id}`) ?? [],
        assetMap,
      );
    }),
  ];

  const summary: KnowledgeSummary = {
    packages: { total: 0, indexed: 0 },
    services: { total: 0, indexed: 0 },
    attention: 0,
    total: entries.length,
  };

  for (const { listing } of entries) {
    const group =
      listing.kind === "package" ? summary.packages : summary.services;
    group.total++;

    if (listing.status === "indexed") group.indexed++;
    else summary.attention++;
  }

  return { entries, summary };
}

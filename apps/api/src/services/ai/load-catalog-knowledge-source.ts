import { findCatalogKnowledgeSourceData } from "../../data/ai/find-catalog-knowledge-source.js";
import type {
  Database,
  CatalogKnowledgeOwner,
} from "../../data/ai/catalog-knowledge-types.js";
import { readCatalogSectionsService } from "../catalog-canvas/read-catalog-sections.js";

export async function loadCatalogKnowledgeSource(
  db: Database,
  owner: CatalogKnowledgeOwner,
) {
  const source = await findCatalogKnowledgeSourceData(db, owner);

  if (!source) return null;

  const sections = await readCatalogSectionsService(db, owner);

  return { ...source, sections };
}

import { findCatalogKnowledgeSourceData } from "../../data/ai/find-catalog-knowledge-source.js";
import { listPackageServicesData } from "../../data/packages/package-services.js";
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
  if (source.kind === "package") {
    const services = (await listPackageServicesData(db, [owner.id])).filter(
      (service) => !service.archived_at,
    );
    return { ...source, sections, services };
  }
  return { ...source, sections, services: [] };
}

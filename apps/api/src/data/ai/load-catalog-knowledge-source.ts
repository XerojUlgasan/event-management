import { readCatalogSectionsData } from "../packages/catalog-canvas.js";
import { listPackageServicesData } from "../packages/package-services.js";
import type {
  Database,
  CatalogKnowledgeOwner,
} from "./catalog-knowledge-types.js";

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

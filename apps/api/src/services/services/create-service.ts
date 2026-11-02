import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { createServiceData } from "../../data/services/create-service.js";
import { lockServiceImages } from "../../data/services/service-image-references.js";
import { serviceAdminDto } from "./service-response.js";
import { InvalidPackageMedia, replaceCatalogSectionsData } from "../../data/packages/catalog-page.js";
import { error } from "../packages/package-rules.js";
export async function createServiceService(db: Kysely<DB>, data: ServiceContent, actorId: string) {
 if (!data.imageId && !data.sections?.some(s => s.widgets.some(w => w.type === "photo" && w.media))) return error("A service photo is required", 400);
 try { return await db.transaction().execute(async trx => {
  await lockServiceImages(trx, [data.imageId]);
  const row = await createServiceData(trx, data);
  await replaceCatalogSectionsData(trx, { kind: "service", id: row.id }, { sections: data.sections ?? [] }, actorId, new Date());
  return serviceAdminDto(trx, row);
 }); } catch (cause) { if (cause instanceof InvalidPackageMedia) return error(cause.message, 400); throw cause; }
}

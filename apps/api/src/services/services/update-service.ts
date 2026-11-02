import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { updateServiceData } from "../../data/services/update-service.js";
import { lockServiceImages } from "../../data/services/service-image-references.js";
import { error, nextUpdate } from "../packages/package-rules.js";
import { serviceAdminDto } from "./service-response.js";
import { cleanupServiceImage } from "./cleanup-service-image.js";
import { InvalidPackageMedia, readCatalogSectionsData, replaceCatalogSectionsData } from "../../data/packages/catalog-page.js";
import { cleanupCatalogMediaService } from "../catalog-media/catalog-media.js";
export async function updateServiceService(db: Kysely<DB>, id: string, data: Omit<ServiceContent, "imageId"> & { removeImage?: boolean; expectedUpdatedAt: string }, actorId: string, uploadedImageId?: string) {
 let previousMedia: string[] = []; let replacedImage: string | null = null;
 try { const outcome = await db.transaction().execute(async trx => {
  const current = await lockServiceData(trx, id);
  if (!current) return error("Service not found", 404);
  if (current.archived_at) return error("Archived services cannot be edited", 409);
  if (current.updated_at.toISOString() !== data.expectedUpdatedAt) return error("Service changed. Refresh and try again", 409);
  const imageId = uploadedImageId ?? (data.removeImage ? null : current.image_id);
  const sections = data.sections ?? await readCatalogSectionsData(trx, { kind: "service", id });
  if (!imageId && !sections.some(s => s.widgets.some(w => w.type === "photo" && w.media))) return error("A service photo is required", 400);
  await lockServiceImages(trx, [current.image_id, imageId]);
  const now = nextUpdate(current.updated_at);
  const row = await updateServiceData(trx, id, { ...data, imageId }, now);
  if (current.image_id !== imageId) replacedImage = current.image_id;
  if (data.sections !== undefined) previousMedia = await replaceCatalogSectionsData(trx, { kind: "service", id }, { sections }, actorId, now);
  return serviceAdminDto(trx, row);
 });
 if (!("status" in outcome)) { await cleanupServiceImage(db, replacedImage); await cleanupCatalogMediaService(db, previousMedia); }
 return outcome;
 } catch (cause) { if (cause instanceof InvalidPackageMedia) return error(cause.message, 400); throw cause; }
}

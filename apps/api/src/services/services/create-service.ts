import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { createServiceData } from "../../data/services/create-service.js";
import { serviceAdminDto } from "./service-response.js";
import {
  InvalidPackageMedia,
  replaceCatalogSectionsData,
} from "../../data/packages/catalog-page.js";
import { error } from "../packages/package-rules.js";
import {
  duplicateTitle,
  reserveCatalogTitle,
} from "../../utils/catalog-title.js";
export async function createServiceService(
  db: Kysely<DB>,
  data: ServiceContent,
  actorId: string,
) {
  if (
    !data.sections?.some((s) =>
      s.widgets.some((w) => w.type === "photo" && w.media),
    )
  )
    return error("A service photo is required", 400);
  try {
    return await db.transaction().execute(async (trx) => {
      const title = await reserveCatalogTitle(trx, "services", data.name);
      if (!title) return error("A service with this title already exists", 409);
      const row = await createServiceData(trx, data, title.slug);
      await replaceCatalogSectionsData(
        trx,
        { kind: "service", id: row.id },
        { sections: data.sections ?? [] },
        actorId,
        new Date(),
      );
      return serviceAdminDto(trx, row);
    });
  } catch (cause) {
    const duplicate = duplicateTitle(
      cause,
      "A service with this title already exists",
    );
    if (duplicate) return duplicate;
    if (cause instanceof InvalidPackageMedia) return error(cause.message, 400);
    throw cause;
  }
}

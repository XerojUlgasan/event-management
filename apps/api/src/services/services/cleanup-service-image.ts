import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { hasServiceImageReference, lockServiceImages } from "../../data/services/service-image-references.js";
import { deleteServiceImage } from "../../utils/service-image-storage.js";

// Serializing reference checks with writes prevents deleting an image newly attached elsewhere.
export async function cleanupServiceImage(db: Kysely<DB>, id: string | null) {
  if (!id) return;
  try {
    await db.transaction().execute(async trx => {
      await lockServiceImages(trx, [id]);
      if (!await hasServiceImageReference(trx, id)) await deleteServiceImage(id);
    });
  } catch {
    console.error("Unable to remove unused service image");
  }
}

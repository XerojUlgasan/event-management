import { assignmentsData, validateAssignmentsData, replaceAssignmentsData } from "../../data/packages/service-assignments.js";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import type { Content } from "../../controllers/packages/schemas.js";
import { findCurrentPackageVersionData } from "../../data/packages/find-current-package-version.js";
import { checkPackageImageData } from "../../data/packages/check-package-image.js";
import { createPackageDraftData } from "../../data/packages/create-package-draft.js";
import { lockPackageImagesData } from "../../data/packages/lock-package-images.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { deleteUnusedPackageImageData } from "../../data/packages/delete-unused-package-image.js";
import { touchPackageData } from "../../data/packages/touch-package.js";
import { updatePackageDraftData } from "../../data/packages/update-package-draft.js";

import { adminDto } from "./package-response.js";
import { error, nextUpdate } from "./package-rules.js";

export async function editPackageDraftService(db: Kysely<DB>, id: string, data: Content & { expectedUpdatedAt: string }) {
  if (data.guestMin > data.guestMax) return error("Minimum guests must not exceed maximum guests", 400);
  return db.transaction().execute(async trx => {
    const pkg = await lockPackageData(trx, id);
    if (!pkg) return error("Package not found", 404);
    if (pkg.archived_at) return error("Archived packages cannot be edited", 409);
    const current = await findCurrentPackageVersionData(trx, pkg.id);
    if (!current || current.updated_at.toISOString() !== data.expectedUpdatedAt) return error("Package changed. Refresh and try again", 409);
    await lockPackageImagesData(trx, [current.image_url, data.imageUrl]);
    if (!await checkPackageImageData(trx, data.imageUrl)) return error("Uploaded image not found", 400);
    const assignments = data.services ?? (await assignmentsData(trx, current.id)).map(({ serviceVersionId, role, includedQuantity, addOnPrice, addOnMaxQuantity }) => ({ serviceVersionId, role, includedQuantity, addOnPrice, addOnMaxQuantity }));
    if (!await validateAssignmentsData(trx, assignments)) return error("Service assignments must reference current published services", 400);
    const updatedAt = nextUpdate(current.updated_at);
    let draftId = current.id;
    if (current.state === "draft") await updatePackageDraftData(trx, current.id, data, updatedAt);
    else draftId = (await createPackageDraftData(trx, pkg.id, current.version + 1, data, updatedAt)).id;
    await replaceAssignmentsData(trx, draftId, assignments);
    if (current.state === "draft") await deleteUnusedPackageImageData(trx, current.image_url);
    await touchPackageData(trx, pkg.id, updatedAt);
    return adminDto(trx, pkg);
  });
}

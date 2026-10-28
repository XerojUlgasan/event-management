import { assignmentsData, validateAssignmentsData } from "../../data/packages/service-assignments.js";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { findPackageDraftData } from "../../data/packages/find-package-draft.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { publishPackageDraftData } from "../../data/packages/publish-package-draft.js";
import { supersedePublishedPackageVersionsData } from "../../data/packages/supersede-published-package-versions.js";
import { updatePackageTimestampData } from "../../data/packages/update-package-timestamp.js";

import { adminDto } from "./package-response.js";
import { error, complete, nextUpdate } from "./package-rules.js";

export async function publishPackageService(db: Kysely<DB>, id: string, expectedUpdatedAt: string) {
  return db.transaction().execute(async trx => {
    const pkg = await lockPackageData(trx, id);
    if (!pkg) return error("Package not found", 404);
    if (pkg.archived_at) return error("Archived packages cannot be published", 409);
    const draft = await findPackageDraftData(trx, pkg.id);
    if (!draft) return error("No draft to publish", 409);
    if (draft.updated_at.toISOString() !== expectedUpdatedAt) return error("Package changed. Refresh and try again", 409);
    const assignments = await assignmentsData(trx, draft.id);
    if (!complete(draft, assignments.some(assignment => assignment.role === "included"))) return error("Complete all package details and set a fixed PHP price before publishing", 400);
    if (!await validateAssignmentsData(trx, assignments)) return error("Service assignments must reference current published services", 400);
    const now = nextUpdate(draft.updated_at);
    await supersedePublishedPackageVersionsData(trx, pkg.id);
    await publishPackageDraftData(trx, draft.id, now);
    return adminDto(trx, await updatePackageTimestampData(trx, pkg.id, now));
  });
}

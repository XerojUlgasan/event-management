import { validateAssignmentsData, replaceAssignmentsData } from "../../data/packages/service-assignments.js";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import type { Content } from "../../controllers/packages/schemas.js";
import { createPackageDraftData } from "../../data/packages/create-package-draft.js";
import { createPackageData } from "../../data/packages/create-package.js";

import { adminDto } from "./package-response.js";
import { error } from "./package-rules.js";

export async function createPackageService(db: Kysely<DB>, data: Content) {
  return db.transaction().execute(async trx => {
    if (!await validateAssignmentsData(trx, data.services ?? [])) return error("Service assignments must reference current published services", 400);
    const pkg = await createPackageData(trx, randomUUID());
    const draft = await createPackageDraftData(trx, pkg.id, 1, data);
    await replaceAssignmentsData(trx, draft.id, data.services ?? []);
    return adminDto(trx, pkg);
  });
}

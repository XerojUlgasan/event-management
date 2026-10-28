import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { archivePackageData } from "../../data/packages/archive-package.js";
import { lockPackageData } from "../../data/packages/lock-package.js";

import { adminDto } from "./package-response.js";
import { error } from "./package-rules.js";

export async function archivePackageService(db: Kysely<DB>, id: string) {
  return db.transaction().execute(async trx => {
    const pkg = await lockPackageData(trx, id);
    if (!pkg) return error("Package not found", 404);
    const updated = await archivePackageData(trx, pkg.id, pkg.archived_at ?? new Date(), new Date());
    return adminDto(trx, updated);
  });
}

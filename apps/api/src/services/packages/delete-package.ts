import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { deletePackageData } from "../../data/packages/delete-package.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { findPublishedPackageHistoryData } from "../../data/packages/find-published-package-history.js";

import { error } from "./package-rules.js";

export async function deletePackageService(db: Kysely<DB>, id: string) {
  try {
    const outcome = await db.transaction().execute(async trx => {
      const pkg = await lockPackageData(trx, id);
      if (!pkg) return error("Package not found", 404);
      if (await findPublishedPackageHistoryData(trx, pkg.id)) return error("Published packages cannot be deleted; archive instead", 409);
      await deletePackageData(trx, pkg.id);
      return null;
    });
    return outcome;
  } catch (cause) {
    if ((cause as { code?: string }).code === "23503") return error("Referenced packages cannot be deleted; archive instead", 409);
    throw cause;
  }
}

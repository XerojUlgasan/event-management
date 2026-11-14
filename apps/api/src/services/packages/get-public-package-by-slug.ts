import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findPublicPackageBySlugData } from "../../data/packages/find-public-package-by-slug.js";
import { packageDto } from "./package-response.js";

export async function getPublicPackageBySlugService(
  db: Kysely<DB>,
  slug: string,
) {
  const row = await findPublicPackageBySlugData(db, slug);
  return row ? packageDto(db, row) : null;
}

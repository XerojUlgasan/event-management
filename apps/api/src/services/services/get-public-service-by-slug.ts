import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findPublicServiceBySlugData } from "../../data/services/find-public-service-by-slug.js";
import { publicDto } from "./service-response.js";

export async function getPublicServiceBySlugService(
  db: Kysely<DB>,
  slug: string,
) {
  const row = await findPublicServiceBySlugData(db, slug);
  return row ? publicDto(db, row) : null;
}

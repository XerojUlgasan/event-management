import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listIncludingPackagesData } from "../../data/services/list-including-packages.js";
import { publicDto } from "../packages/package-response.js";
import { listPublicServicesService } from "./list-public-services.js";

export async function listIncludingPackagesService(db: Kysely<DB>, serviceId: string) {
  if (!(await listPublicServicesService(db, serviceId)).length) return null;
  const rows = await listIncludingPackagesData(db, serviceId);
  const result = [];
  for (const row of rows) result.push(await publicDto(db, row));
  return result;
}

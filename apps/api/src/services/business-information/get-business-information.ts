import { businessInformationSchema } from "@event-management/contracts/business-information";
import type { Kysely } from "kysely";
import { getBusinessInformationData } from "../../data/business-information/get-business-information.js";
import type { DB } from "../../db/types.js";

export async function getBusinessInformationService(db: Kysely<DB>) {
  const row = await getBusinessInformationData(db);

  return {
    information: businessInformationSchema.parse(row?.information ?? {}),
    updatedAt: row?.updated_at.toISOString() ?? null,
  };
}

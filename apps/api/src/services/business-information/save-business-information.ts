import {
  businessInformationSchema,
  type SaveBusinessInformation,
} from "@event-management/contracts/business-information";
import type { Kysely } from "kysely";
import { createBusinessInformationData } from "../../data/business-information/create-business-information.js";
import { lockBusinessInformationData } from "../../data/business-information/lock-business-information.js";
import { updateBusinessInformationData } from "../../data/business-information/update-business-information.js";
import type { DB } from "../../db/types.js";
import { serviceError } from "../../utils/service-result.js";

function nextBusinessInformationUpdate(previous: Date) {
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}

export async function saveBusinessInformationService(
  db: Kysely<DB>,
  body: SaveBusinessInformation,
) {
  const row = await db.transaction().execute(async (trx) => {
    if (body.expectedUpdatedAt === null)
      return createBusinessInformationData(trx, body.information);

    const current = await lockBusinessInformationData(trx);

    if (current?.updated_at.toISOString() !== body.expectedUpdatedAt) return;

    const now = nextBusinessInformationUpdate(current.updated_at);

    return updateBusinessInformationData(trx, body.information, now);
  });

  if (!row)
    return serviceError(
      "Business information changed. Refresh and try again",
      409,
    );

  return {
    information: businessInformationSchema.parse(row.information ?? {}),
    updatedAt: row.updated_at.toISOString(),
  };
}

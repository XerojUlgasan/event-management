import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  checklistContext,
  checklistDto,
  type Actor,
} from "./event-checklists.js";

export function getEventChecklistService(
  db: Kysely<DB>,
  id: string,
  actor: Actor,
) {
  return db.transaction().execute(async (trx) => {
    const { row } = await checklistContext(trx, id, actor, false);
    return row ? checklistDto(row) : null;
  });
}

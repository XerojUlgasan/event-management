import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { checklistContext, checklistDto, fail, type Actor } from "./event-checklists.js";
import { createEventChecklistData } from "../../data/event-checklists/create-event-checklist.js";

export function createEventChecklistService(db: Kysely<DB>, id: string, actor: Actor, title: string) {
  return db.transaction().execute(async trx => {
    const ctx = await checklistContext(trx, id, actor, true);
    if (!ctx.admin) return fail("Admin access required", 403);
    if (ctx.row) return fail("This event day already has a checklist", 409);
    return checklistDto(await createEventChecklistData(trx, id, actor.id, title));
  });
}

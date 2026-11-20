import type { Database } from "./quotation-revision.js";

export function quotationServicesData(
  db: Database,
  ids: string[],
  lock: boolean,
) {
  const query = db
    .selectFrom("services")
    .select(["id", "name", "archived_at"])
    .where("id", "in", ids)
    .orderBy("id");

  return (lock ? query.forUpdate() : query).execute();
}

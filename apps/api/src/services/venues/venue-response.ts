import type { Selectable } from "kysely";
import type { Venues } from "../../db/types.js";

type Row = Selectable<Venues>;

export function venueDto(row: Row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    description: row.description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    archivedAt: row.archived_at?.toISOString() ?? null,
  };
}

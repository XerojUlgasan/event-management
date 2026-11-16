import { sql, type RawBuilder } from "kysely";

// JSONB containment can use the GIN indexes on each owner's canvas.
export const canvasContainsMedia = (
  canvas: RawBuilder<unknown>,
  id: RawBuilder<unknown>,
) =>
  sql<boolean>`${canvas} @> jsonb_build_array(jsonb_build_object('widgets', jsonb_build_array(jsonb_build_object('mediaId', ${id}::text))))`;

export const anyCanvasContainsMedia = (
  id: RawBuilder<unknown>,
) => sql<boolean>`(
  EXISTS (SELECT 1 FROM packages p WHERE ${canvasContainsMedia(sql.ref("p.canvas"), id)})
  OR EXISTS (SELECT 1 FROM services s WHERE ${canvasContainsMedia(sql.ref("s.canvas"), id)})
)`;

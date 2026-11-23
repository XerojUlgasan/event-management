import { sql, type RawBuilder } from "kysely";

// JSONB containment can use the GIN indexes on each owner's canvas.
export const canvasContainsMedia = (
  canvas: RawBuilder<unknown>,
  id: RawBuilder<unknown>,
) =>
  sql<boolean>`${canvas} @> jsonb_build_array(jsonb_build_object('widgets', jsonb_build_array(jsonb_build_object('mediaId', ${id}::text))))`;

export const catalogOwnerContainsMedia = (
  alias: string,
  id: RawBuilder<unknown>,
) =>
  sql<boolean>`(${canvasContainsMedia(sql.ref(`${alias}.canvas`), id)} OR ${sql.ref(`${alias}.thumbnail_media_id`)} = ${id}::uuid)`;

export const anyCatalogOwnerContainsMedia = (
  id: RawBuilder<unknown>,
) => sql<boolean>`(
  EXISTS (SELECT 1 FROM packages p WHERE ${catalogOwnerContainsMedia("p", id)})
  OR EXISTS (SELECT 1 FROM services s WHERE ${catalogOwnerContainsMedia("s", id)})
)`;

export const anyCanvasContainsMedia = (
  id: RawBuilder<unknown>,
) => sql<boolean>`(
  EXISTS (SELECT 1 FROM packages p WHERE ${canvasContainsMedia(sql.ref("p.canvas"), id)})
  OR EXISTS (SELECT 1 FROM services s WHERE ${canvasContainsMedia(sql.ref("s.canvas"), id)})
)`;

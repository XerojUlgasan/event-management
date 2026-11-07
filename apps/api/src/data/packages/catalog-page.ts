import { randomUUID } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import type { Content } from "../../controllers/packages/schemas.js";
import type { DB } from "../../db/types.js";
export type Database = Kysely<DB> | Transaction<DB>;
export class InvalidPackageMedia extends Error {}

type PageOwner = { kind: "package" | "service" | "venue"; id: string };
const ownerColumn = (owner: PageOwner) => owner.kind === "package" ? "package_id" : owner.kind === "service" ? "service_id" : "venue_id";
export async function readCatalogSectionsData(db: Database, owner: PageOwner) {
  const page = await db
    .selectFrom("catalog_pages")
    .select("id")
    .where(ownerColumn(owner), "=", owner.id)
    .executeTakeFirst();
  if (!page) return [];
  const sections = await db
    .selectFrom("catalog_sections")
    .selectAll()
    .where("page_id", "=", page.id)
    .orderBy("sort_order")
    .execute();
  if (!sections.length) return [];
  const widgets = await db
    .selectFrom("catalog_widgets as w")
    .leftJoin("media_assets as m", "m.id", "w.media_id")
    .selectAll("w")
    .select([
      "m.kind as media_kind",
      "m.source as media_source",
      "m.url as media_url",
      "m.mime_type as media_mime_type",
    ])
    .where(
      "w.section_id",
      "in",
      sections.map((section) => section.id),
    )
    .orderBy("w.sort_order")
    .execute();
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    widgets: widgets
      .filter((widget) => widget.section_id === section.id)
      .map((widget) => ({
        id: widget.id,
        type: widget.type as "photo" | "markdown" | "video",
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        markdown: widget.markdown,
        alt: widget.alt,
        caption: widget.caption,
        autoplay: widget.autoplay,
        media: widget.media_id
          ? {
              id: widget.media_id,
              kind: widget.media_kind as "image" | "video",
              source: widget.media_source as "upload" | "sample",
              url:
                widget.media_source === "upload"
                  ? `/v1/catalog-media/${widget.media_id}`
                  : widget.media_url!,
              ...(widget.media_mime_type
                ? { mimeType: widget.media_mime_type }
                : {}),
            }
          : null,
      })),
  }));
}
export const readPackageSectionsData = (db: Database, packageId: string) => readCatalogSectionsData(db, { kind: "package", id: packageId });
export async function listCatalogMediaIdsData(db: Database, owner: PageOwner) {
  const rows = await db
    .selectFrom("catalog_widgets as w")
    .innerJoin("catalog_sections as s", "s.id", "w.section_id")
    .innerJoin("catalog_pages as p", "p.id", "s.page_id")
    .select("w.media_id")
    .where(owner.kind === "package" ? "p.package_id" : owner.kind === "service" ? "p.service_id" : "p.venue_id", "=", owner.id)
    .where("w.media_id", "is not", null)
    .execute();
  return [
    ...new Set(rows.flatMap((row) => (row.media_id ? [row.media_id] : []))),
  ];
}
export const listPackageMediaIdsData = (db: Database, packageId: string) => listCatalogMediaIdsData(db, { kind: "package", id: packageId });
export async function replaceCatalogSectionsData(
  db: Transaction<DB>,
  owner: PageOwner,
  content: Pick<Content, "sections">,
  actorId: string,
  now: Date,
) {
  const previousMediaIds = await listCatalogMediaIdsData(db, owner);
  let page = await db
    .selectFrom("catalog_pages")
    .select("id")
    .where(ownerColumn(owner), "=", owner.id)
    .executeTakeFirst();
  if (!page)
    page = await db
      .insertInto("catalog_pages")
      .values({ ...(owner.kind === "package" ? { package_id: owner.id } : owner.kind === "service" ? { service_id: owner.id } : { venue_id: owner.id }), created_at: now, updated_at: now })
      .returning("id")
      .executeTakeFirstOrThrow();
  // Lock all referenced uploads in stable order before checking ownership or replacing references.
  const uploadIds = [
    ...new Set(
      content.sections.flatMap((section) =>
        section.widgets.flatMap((widget) =>
          widget.media?.source === "upload" && widget.media.id
            ? [widget.media.id]
            : [],
        ),
      ),
    ),
  ].sort();
  for (const id of uploadIds) {
    const media = await db
      .selectFrom("media_assets")
      .selectAll()
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirst();
    if (!media || media.source !== "upload")
      throw new InvalidPackageMedia("Uploaded media is unavailable");
    const references = await db
      .selectFrom("catalog_widgets as w")
      .innerJoin("catalog_sections as s", "s.id", "w.section_id")
      .innerJoin("catalog_pages as p", "p.id", "s.page_id")
      .select(["s.page_id", "p.package_id", "p.service_id", "p.venue_id"])
      .where("w.media_id", "=", id)
      .execute();
    if (!references.length && media.created_by !== actorId)
      throw new InvalidPackageMedia(
        "Uploaded media belongs to another administrator",
      );
    if (references.some((reference) => owner.kind === "package" ? reference.package_id !== owner.id : owner.kind === "service" ? reference.service_id !== owner.id : reference.venue_id !== owner.id))
      throw new InvalidPackageMedia(
        "Uploaded media already belongs to another catalog page",
      );
    const quotationReferences = await db.selectFrom("quotations as q").select("q.offered_package_id").where(sql<boolean>`jsonb_path_exists(q.offered_package_terms, '$.package.sections[*].widgets[*].media.id ? (@ == $id)', jsonb_build_object('id', ${id}::text))`).execute();
    if (quotationReferences.some(reference => owner.kind !== "package" || reference.offered_package_id !== owner.id))
      throw new InvalidPackageMedia("Uploaded media belongs to another package offer");
    const requested = content.sections
      .flatMap((section) => section.widgets)
      .filter(
        (widget) => widget.media?.source === "upload" && widget.media.id === id,
      );
    if (requested.some((widget) => widget.media!.kind !== media.kind))
      throw new InvalidPackageMedia(
        "Uploaded media kind does not match the widget",
      );
  }
  await db
    .deleteFrom("catalog_sections")
    .where("page_id", "=", page.id)
    .execute();
  await db
    .updateTable("catalog_pages")
    .set({ updated_at: now })
    .where("id", "=", page.id)
    .execute();
  for (const [sortOrder, section] of content.sections.entries()) {
    const sectionId = randomUUID();
    await db
      .insertInto("catalog_sections")
      .values({
        id: sectionId,
        page_id: page.id,
        title: section.title,
        sort_order: sortOrder,
      })
      .execute();
    for (const [widgetOrder, widget] of section.widgets.entries()) {
      let mediaId: string | null = null;
      if (widget.media) {
        if (widget.media.source === "upload") mediaId = widget.media.id!;
        else {
          mediaId = randomUUID();
          await db
            .insertInto("media_assets")
            .values({
              id: mediaId,
              kind: widget.media.kind,
              source: widget.media.source,
              url: widget.media.url,
              created_by: actorId,
            })
            .execute();
        }
      }
      await db
        .insertInto("catalog_widgets")
        .values({
          id: randomUUID(),
          section_id: sectionId,
          type: widget.type,
          sort_order: widgetOrder,
          x: widget.x,
          y: widget.y,
          w: widget.w,
          h: widget.h,
          markdown: widget.markdown,
          media_id: mediaId,
          alt: widget.alt,
          caption: widget.caption,
          autoplay: widget.autoplay,
        })
        .execute();
    }
  }
  return previousMediaIds;
}

export const replacePackageSectionsData = (db: Transaction<DB>, packageId: string, content: Content, actorId: string, now: Date) => replaceCatalogSectionsData(db, { kind: "package", id: packageId }, content, actorId, now);

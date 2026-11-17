import { randomUUID } from "node:crypto";
import {
  sectionsSchema,
  storedSectionsSchema,
} from "@event-management/contracts/catalog-canvas";
import { sql, type Kysely, type Transaction } from "kysely";
import { type Content } from "../../controllers/packages/schemas.js";
import type { DB } from "../../db/types.js";
import { canvasContainsMedia } from "../catalog-media/canvas-reference.js";

export type Database = Kysely<DB> | Transaction<DB>;
export class InvalidPackageMedia extends Error {}
type CanvasOwner = { kind: "package" | "service"; id: string };

async function readStoredCanvas(db: Database, owner: CanvasOwner) {
  const table = owner.kind === "package" ? "packages" : "services";
  const row = await db
    .selectFrom(table)
    .select("canvas")
    .where("id", "=", owner.id)
    .executeTakeFirst();
  if (!row) return [];
  const sections = storedSectionsSchema.parse(row.canvas);
  return sections;
}

export async function readCatalogSectionsData(
  db: Database,
  owner: CanvasOwner,
) {
  const sections = await readStoredCanvas(db, owner);
  const serviceIds = [
    ...new Set(
      sections.flatMap((s) =>
        s.widgets.flatMap((w) =>
          w.type === "service" && w.serviceId ? [w.serviceId] : [],
        ),
      ),
    ),
  ];
  const services = serviceIds.length
    ? await db
        .selectFrom("services")
        .select(["id", "slug", "name", "description", "canvas"])
        .where("id", "in", serviceIds)
        .where("archived_at", "is", null)
        .execute()
    : [];
  const servicePhotos = new Map(
    services.map((service) => [
      service.id,
      storedSectionsSchema
        .parse(service.canvas)
        .flatMap((s) => s.widgets)
        .find((w) => w.type === "photo" && w.mediaId)?.mediaId ?? null,
    ]),
  );
  const ids = [
    ...new Set([
      ...sections.flatMap((s) =>
        s.widgets.flatMap((w) => (w.mediaId ? [w.mediaId] : [])),
      ),
      ...[...servicePhotos.values()].filter((id): id is string => id !== null),
    ]),
  ];
  const assets = ids.length
    ? await db
        .selectFrom("media_assets")
        .selectAll()
        .where("id", "in", ids)
        .execute()
    : [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const serviceById = new Map(
    services.map((service) => {
      const photoId = servicePhotos.get(service.id);
      const photo = photoId ? byId.get(photoId) : undefined;
      return [
        service.id,
        {
          id: service.id,
          slug: service.slug,
          name: service.name,
          description: service.description,
          imageUrl: photo
            ? photo.source === "upload"
              ? `/v1/catalog-media/${photo.id}`
              : photo.url
            : null,
        },
      ];
    }),
  );
  return sectionsSchema.parse(
    sections.map((section) => ({
      ...section,
      widgets: section.widgets.map(({ mediaId, ...widget }) => {
        if (widget.type === "service")
          return {
            ...widget,
            media: null,
            service: serviceById.get(widget.serviceId ?? "") ?? null,
          };
        if (!mediaId) return { ...widget, media: null };
        const media = byId.get(mediaId);
        if (!media) throw new Error(`Catalog media ${mediaId} is unavailable`);
        return {
          ...widget,
          media: {
            id: media.id,
            kind: media.kind,
            source: media.source,
            url:
              media.source === "upload"
                ? `/v1/catalog-media/${media.id}`
                : media.url,
            ...(media.mime_type ? { mimeType: media.mime_type } : {}),
          },
        };
      }),
    })),
  );
}
export const readPackageSectionsData = (db: Database, packageId: string) =>
  readCatalogSectionsData(db, { kind: "package", id: packageId });
export async function listCatalogMediaIdsData(
  db: Database,
  owner: CanvasOwner,
) {
  const sections = await readStoredCanvas(db, owner);
  return [
    ...new Set(
      sections.flatMap((s) =>
        s.widgets.flatMap((w) => (w.mediaId ? [w.mediaId] : [])),
      ),
    ),
  ];
}
export const listPackageMediaIdsData = (db: Database, packageId: string) =>
  listCatalogMediaIdsData(db, { kind: "package", id: packageId });

export async function replaceCatalogSectionsData(
  db: Transaction<DB>,
  owner: CanvasOwner,
  content: Pick<Content, "sections">,
  actorId: string,
) {
  const previous = await readStoredCanvas(db, owner);
  const existing = new Set(
    previous.flatMap((s) =>
      s.widgets.flatMap((w) =>
        w.type === "service" && w.serviceId ? [`${w.id}:${w.serviceId}`] : [],
      ),
    ),
  );
  const refs = content.sections.flatMap((s) =>
    s.widgets.filter((w) => w.type === "service" && w.serviceId),
  );
  const serviceIds = [
    ...new Set(
      refs.flatMap((w) => (w.serviceId ? [w.serviceId.toLowerCase()] : [])),
    ),
  ].sort();
  for (const id of serviceIds) {
    const service = await db
      .selectFrom("services")
      .select(["id", "archived_at"])
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirst();
    if (
      (!service || service.archived_at) &&
      refs.some(
        (w) =>
          w.serviceId?.toLowerCase() === id && !existing.has(`${w.id}:${id}`),
      )
    )
      throw new InvalidPackageMedia("Selected service is unavailable");
  }
  const previousMediaIds = await listCatalogMediaIdsData(db, owner);
  const uploadIds = [
    ...new Set(
      content.sections.flatMap((section) =>
        section.widgets.flatMap((widget) =>
          widget.media?.source === "upload" && widget.media.id
            ? [widget.media.id.toLowerCase()]
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
    const ref = sql`${id}`;
    const packageRefs = await db
      .selectFrom("packages as p")
      .select("p.id")
      .where(canvasContainsMedia(sql.ref("p.canvas"), ref))
      .execute();
    const serviceRefs = await db
      .selectFrom("services as s")
      .select("s.id")
      .where(canvasContainsMedia(sql.ref("s.canvas"), ref))
      .execute();
    if (
      !packageRefs.length &&
      !serviceRefs.length &&
      media.created_by !== actorId
    )
      throw new InvalidPackageMedia(
        "Uploaded media belongs to another administrator",
      );
    if (
      packageRefs.some((r) => owner.kind !== "package" || r.id !== owner.id) ||
      serviceRefs.some((r) => owner.kind !== "service" || r.id !== owner.id)
    )
      throw new InvalidPackageMedia(
        "Uploaded media already belongs to another catalog canvas",
      );
    if (
      content.sections
        .flatMap((s) => s.widgets)
        .some(
          (w) =>
            w.media?.source === "upload" &&
            w.media.id?.toLowerCase() === id &&
            w.media.kind !== media.kind,
        )
    )
      throw new InvalidPackageMedia(
        "Uploaded media kind does not match the widget",
      );
  }
  const sections = [];
  for (const section of content.sections) {
    const widgets = [];
    for (const {
      media,
      service: _service,
      serviceId,
      ...widget
    } of section.widgets) {
      let mediaId: string | null = null;
      if (media?.source === "upload") {
        if (!media.id)
          throw new InvalidPackageMedia("Uploaded media is unavailable");
        mediaId = media.id.toLowerCase();
      } else if (media) {
        mediaId = randomUUID();
        await db
          .insertInto("media_assets")
          .values({
            id: mediaId,
            kind: media.kind,
            source: media.source,
            url: media.url,
            created_by: actorId,
          })
          .execute();
      }
      widgets.push({
        ...widget,
        mediaId,
        ...(widget.type === "service"
          ? { serviceId: serviceId?.toLowerCase() }
          : {}),
      });
    }
    sections.push({ id: section.id, title: section.title, widgets });
  }
  const validatedSections = storedSectionsSchema.parse(sections);
  const table = owner.kind === "package" ? "packages" : "services";
  await db
    .updateTable(table)
    .set({ canvas: sql`${JSON.stringify(validatedSections)}::jsonb` })
    .where("id", "=", owner.id)
    .executeTakeFirstOrThrow();
  return previousMediaIds;
}

export const replacePackageSectionsData = (
  db: Transaction<DB>,
  packageId: string,
  content: Content,
  actorId: string,
) =>
  replaceCatalogSectionsData(
    db,
    { kind: "package", id: packageId },
    content,
    actorId,
  );

import {
  sectionsSchema,
  storedSectionsSchema,
} from "@event-management/contracts/catalog-canvas";
import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { listPackageServicesData } from "../packages/package-services.js";

type Database = Kysely<DB> | Transaction<DB>;
type Owner = { kind: "package" | "service"; id: string };
export async function loadKnowledgeSourcesData(db: Database, owner?: Owner) {
  const [packages, services] = await Promise.all([
    owner?.kind === "service"
      ? Promise.resolve([])
      : db
          .selectFrom("packages")
          .selectAll()
          .where("package_type", "=", "catalog")
          .where("archived_at", "is", null)
          .$if(!!owner, (q) => q.where("id", "=", owner!.id))
          .execute(),
    owner?.kind === "package"
      ? Promise.resolve([])
      : db
          .selectFrom("services")
          .selectAll()
          .where("archived_at", "is", null)
          .$if(!!owner, (q) => q.where("id", "=", owner!.id))
          .execute(),
  ]);
  const packageIds = packages.map((p) => p.id);
  const serviceIds = services.map((s) => s.id);
  const rows =
    packageIds.length || serviceIds.length
      ? await db
          .selectFrom("catalog_knowledge")
          .select([
            "package_id",
            "service_id",
            "chunk_key",
            "content_markdown",
            "content_hash",
            "media_id",
            "embedding_model",
            "embedded_at",
            sql<boolean>`embedding IS NOT NULL`.as("has_embedding"),
          ])
          .where((eb) =>
            eb.or([
              ...(packageIds.length
                ? [eb("package_id", "in", packageIds)]
                : []),
              ...(serviceIds.length
                ? [eb("service_id", "in", serviceIds)]
                : []),
            ]),
          )
          .execute()
      : [];
  const mediaIds = [
    ...new Set(
      [...packages, ...services].flatMap((record) =>
        storedSectionsSchema
          .parse(record.canvas)
          .flatMap((section) =>
            section.widgets.flatMap((widget) =>
              widget.mediaId ? [widget.mediaId] : [],
            ),
          ),
      ),
    ),
  ];
  const assets = mediaIds.length
    ? await db
        .selectFrom("media_assets")
        .selectAll()
        .where("id", "in", mediaIds)
        .execute()
    : [];
  const packageServices = await listPackageServicesData(
    db,
    packages.map((p) => p.id),
  );
  const servicesByPackage = new Map<string, typeof packageServices>();
  for (const service of packageServices) {
    const list = servicesByPackage.get(service.package_id) ?? [];
    list.push(service);
    servicesByPackage.set(service.package_id, list);
  }
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const rowsByOwner = new Map<string, typeof rows>();
  for (const row of rows) {
    const ownerKey = row.package_id
      ? `package:${row.package_id}`
      : `service:${row.service_id}`;
    const list = rowsByOwner.get(ownerKey) ?? [];
    list.push(row);
    rowsByOwner.set(ownerKey, list);
  }
  function sections(canvas: unknown) {
    return sectionsSchema.parse(
      storedSectionsSchema.parse(canvas).map((section) => ({
        ...section,
        widgets: section.widgets.map(({ mediaId, ...widget }) => {
          const media = mediaId ? assetMap.get(mediaId) : undefined;
          return {
            ...widget,
            media: media
              ? {
                  id: media.id,
                  kind: media.kind,
                  source: media.source,
                  url:
                    media.source === "upload"
                      ? `/v1/catalog-media/${media.id}`
                      : media.url,
                  ...(media.mime_type ? { mimeType: media.mime_type } : {}),
                }
              : null,
          };
        }),
      })),
    );
  }
  return {
    packages,
    services,
    servicesByPackage,
    assetMap,
    rowsByOwner,
    sections,
  };
}

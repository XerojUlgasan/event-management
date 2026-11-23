import { sectionsSchema } from "@event-management/contracts/catalog-canvas";
import type {
  Database,
  CanvasOwner,
} from "../../data/catalog-canvas/catalog-canvas-types.js";
import {
  readStoredCanvasData,
  listCanvasPackagesData,
  listCanvasServicesData,
  listCanvasAssetsData,
} from "../../data/catalog-canvas/catalog-canvas-queries.js";
import {
  canvasMediaIds,
  canvasReference,
  canvasMedia,
} from "../../utils/catalog-canvas.js";

export async function readCatalogSectionsService(
  db: Database,
  owner: CanvasOwner,
) {
  const sections = await readStoredCanvasData(db, owner);

  const serviceIds = [
    ...new Set(
      sections.flatMap((s) =>
        s.widgets.flatMap((w) =>
          w.type === "service" && w.serviceId ? [w.serviceId] : [],
        ),
      ),
    ),
  ];

  const packageIds = [
    ...new Set(
      sections.flatMap((section) =>
        section.widgets.flatMap((widget) =>
          widget.type === "package" && widget.packageId
            ? [widget.packageId]
            : [],
        ),
      ),
    ),
  ];

  const packages = await listCanvasPackagesData(db, packageIds);
  const services = await listCanvasServicesData(db, serviceIds);
  const ids = canvasMediaIds(sections);
  const assets = await listCanvasAssetsData(db, ids);

  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  const serviceById = new Map(
    services.map((service) => [service.id, canvasReference(service)]),
  );

  const packageById = new Map(
    packages.map((item) => [item.id, canvasReference(item)]),
  );

  return sectionsSchema.parse(
    sections.map((section) => ({
      ...section,
      widgets: section.widgets.map(({ mediaId, ...widget }) => {
        if (widget.type === "package")
          return {
            ...widget,
            media: null,
            package: packageById.get(widget.packageId ?? "") ?? null,
          };

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
          media: canvasMedia(media),
        };
      }),
    })),
  );
}

export async function listCatalogMediaIdsService(
  db: Database,
  owner: CanvasOwner,
) {
  const sections = await readStoredCanvasData(db, owner);

  return canvasMediaIds(sections);
}

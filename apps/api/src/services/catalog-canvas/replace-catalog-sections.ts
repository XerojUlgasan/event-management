import { randomUUID } from "node:crypto";
import {
  sectionsSchema,
  storedSectionsSchema,
} from "@event-management/contracts/catalog-canvas";
import { packageAddonServicesSchema } from "@event-management/contracts/catalog-service-terms";
import type { PackageAddonService } from "@event-management/contracts/catalog";
import type { z } from "zod";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { CanvasOwner } from "../../data/catalog-canvas/catalog-canvas-types.js";
import {
  readStoredCanvasData,
  readPackageAddonServicesData,
  lockCanvasServiceData,
  lockCanvasPackageData,
  findCanvasMediaOwnersData,
  updateStoredCanvasData,
} from "../../data/catalog-canvas/catalog-canvas-queries.js";
import { lockCatalogMediaData } from "../../data/catalog-media/lock-catalog-media.js";
import { createCatalogMediaData } from "../../data/catalog-media/create-catalog-media.js";
import {
  canvasServiceIds,
  storedCanvasWidget,
} from "../../utils/catalog-canvas.js";
import { listCatalogMediaIdsService } from "./read-catalog-sections.js";
import { listOwnerMediaIdsData } from "../../data/catalog-media/catalog-media-ownership.js";

export class InvalidCatalogMedia extends Error {}

export async function replaceCatalogSectionsService(
  db: Transaction<DB>,
  owner: CanvasOwner,
  content: {
    sections: z.infer<typeof sectionsSchema>;
    addonServices?: PackageAddonService[];
  },
  actorId: string,
  sourcePackageId?: string,
) {
  const previous = await readStoredCanvasData(db, owner);
  const baseline = sourcePackageId
    ? await readStoredCanvasData(db, { kind: "package", id: sourcePackageId })
    : previous;
  const packageRow =
    owner.kind === "package"
      ? await readPackageAddonServicesData(db, owner.id)
      : undefined;
  const addonServices = packageAddonServicesSchema.parse(
    content.addonServices ?? [],
  );

  if (addonServices.length && packageRow?.package_type !== "custom")
    throw new InvalidCatalogMedia(
      "Add-on services are only allowed on private custom packages",
    );

  if (
    owner.kind === "service" &&
    content.sections.some((section) =>
      section.widgets.some((widget) => widget.serviceTerms !== undefined),
    )
  )
    throw new InvalidCatalogMedia(
      "Package service terms are not allowed on service pages",
    );

  const includedServiceIds = canvasServiceIds(content.sections);

  if (
    addonServices.some((addon) =>
      includedServiceIds.has(addon.serviceId.toLowerCase()),
    )
  )
    throw new InvalidCatalogMedia(
      "A service cannot be both included and an add-on",
    );

  const existingAddons = new Set(
    packageAddonServicesSchema
      .parse(packageRow?.addon_services ?? [])
      .map(
        (addon) => `${addon.id.toLowerCase()}:${addon.serviceId.toLowerCase()}`,
      ),
  );

  const existing = new Set(
    baseline.flatMap((s) =>
      s.widgets.flatMap((w) =>
        w.type === "service" && w.serviceId
          ? [`${w.id.toLowerCase()}:${w.serviceId}`]
          : [],
      ),
    ),
  );

  const refs = content.sections.flatMap((s) =>
    s.widgets.filter((w) => w.type === "service" && w.serviceId),
  );

  const serviceIds = [
    ...new Set([
      ...refs.flatMap((w) => (w.serviceId ? [w.serviceId.toLowerCase()] : [])),
      ...addonServices.map((addon) => addon.serviceId.toLowerCase()),
    ]),
  ].sort();

  for (const id of serviceIds) {
    const service = await lockCanvasServiceData(db, id);

    if (
      (!service || service.archived_at) &&
      (refs.some(
        (w) =>
          w.serviceId?.toLowerCase() === id &&
          !existing.has(`${w.id.toLowerCase()}:${id}`),
      ) ||
        addonServices.some(
          (addon) =>
            addon.serviceId.toLowerCase() === id &&
            !existingAddons.has(`${addon.id.toLowerCase()}:${id}`),
        ))
    )
      throw new InvalidCatalogMedia("Selected service is unavailable");
  }

  const existingPackages = new Set(
    baseline.flatMap((section) =>
      section.widgets.flatMap((widget) =>
        widget.type === "package" && widget.packageId
          ? [`${widget.id.toLowerCase()}:${widget.packageId}`]
          : [],
      ),
    ),
  );

  const packageRefs = content.sections.flatMap((section) =>
    section.widgets.filter(
      (widget) => widget.type === "package" && widget.packageId,
    ),
  );

  const packageIds = [
    ...new Set(
      packageRefs.flatMap((widget) =>
        widget.packageId ? [widget.packageId.toLowerCase()] : [],
      ),
    ),
  ].sort();

  for (const id of packageIds) {
    const item = await lockCanvasPackageData(db, id);

    if (
      (!item || item.archived_at || item.package_type !== "catalog") &&
      packageRefs.some(
        (widget) =>
          widget.packageId?.toLowerCase() === id &&
          !existingPackages.has(`${widget.id.toLowerCase()}:${id}`),
      )
    )
      throw new InvalidCatalogMedia("Selected package is unavailable");
  }

  const previousMediaIds = await listCatalogMediaIdsService(db, owner);

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

  // Include the existing canvas and dedicated thumbnail before taking any
  // media lock, so attachment, relocation and cleanup acquire them in ID order.
  const ownerMediaIds = await listOwnerMediaIdsData(db, owner);

  for (const id of [...new Set([...uploadIds, ...ownerMediaIds])].sort())
    await lockCatalogMediaData(db, id);

  for (const id of uploadIds) {
    const media = await lockCatalogMediaData(db, id);

    if (!media || media.source !== "upload")
      throw new InvalidCatalogMedia("Uploaded media is unavailable");

    const { packageRefs, serviceRefs } = await findCanvasMediaOwnersData(
      db,
      id,
    );

    if (
      !packageRefs.length &&
      !serviceRefs.length &&
      media.created_by !== actorId
    )
      throw new InvalidCatalogMedia(
        "Uploaded media belongs to another administrator",
      );

    if (
      packageRefs.some((r) => owner.kind !== "package" || r.id !== owner.id) ||
      serviceRefs.some((r) => owner.kind !== "service" || r.id !== owner.id)
    )
      throw new InvalidCatalogMedia(
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
      throw new InvalidCatalogMedia(
        "Uploaded media kind does not match the widget",
      );
  }

  const sections = [];

  for (const section of content.sections) {
    const widgets = [];

    for (const inputWidget of section.widgets) {
      const { media } = inputWidget;
      let mediaId: string | null = null;

      if (media?.source === "upload") {
        if (!media.id)
          throw new InvalidCatalogMedia("Uploaded media is unavailable");

        mediaId = media.id.toLowerCase();
      } else if (media) {
        mediaId = randomUUID();
        await createCatalogMediaData(db, {
          id: mediaId,
          kind: media.kind,
          source: media.source,
          url: media.url,
          created_by: actorId,
        });
      }

      widgets.push(storedCanvasWidget(inputWidget, mediaId));
    }

    sections.push({
      id: section.id.toLowerCase(),
      title: section.title,
      widgets,
    });
  }

  const validatedSections = storedSectionsSchema.parse(sections);
  await updateStoredCanvasData(
    db,
    owner,
    validatedSections,
    addonServices.map(({ service: _preview, ...addon }) => ({
      ...addon,
      id: addon.id.toLowerCase(),
      serviceId: addon.serviceId.toLowerCase(),
    })),
  );

  return previousMediaIds;
}

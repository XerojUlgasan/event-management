import {
  sectionsSchema,
  storedSectionsSchema,
} from "@event-management/contracts/catalog-canvas";
import type { Selectable } from "kysely";
import type { z } from "zod";
import type { MediaAssets } from "../db/types.js";

type StoredSections = z.infer<typeof storedSectionsSchema>;
type Asset = Selectable<MediaAssets>;
type CatalogReference = {
  id: string;
  slug: string;
  name: string;
  description: string;
};

export function canvasMediaIds(sections: StoredSections) {
  return [
    ...new Set(
      sections.flatMap((section) =>
        section.widgets.flatMap((widget) =>
          widget.mediaId ? [widget.mediaId] : [],
        ),
      ),
    ),
  ];
}

export function firstCanvasPhotoId(canvas: unknown) {
  return (
    storedSectionsSchema
      .parse(canvas)
      .flatMap((section) => section.widgets)
      .find((widget) => widget.type === "photo" && widget.mediaId)?.mediaId ??
    null
  );
}

export function catalogMediaUrl(media: Asset) {
  return media.source === "upload"
    ? `/v1/catalog-media/${media.id}`
    : media.url;
}

export function canvasReference(
  record: CatalogReference,
  photo: Asset | undefined,
) {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    imageUrl: photo ? catalogMediaUrl(photo) : null,
  };
}

export function canvasMedia(media: Asset) {
  return {
    id: media.id,
    kind: media.kind,
    source: media.source,
    url: catalogMediaUrl(media),
    ...(media.mime_type ? { mimeType: media.mime_type } : {}),
  };
}

export function storedCanvasWidget(
  {
    media: _media,
    service: _service,
    serviceId,
    package: _package,
    packageId,
    ...widget
  }: z.infer<typeof sectionsSchema>[number]["widgets"][number],
  mediaId: string | null,
) {
  return {
    ...widget,
    mediaId,
    ...(widget.type === "service"
      ? { serviceId: serviceId?.toLowerCase() }
      : {}),
    ...(widget.type === "package"
      ? { packageId: packageId?.toLowerCase() }
      : {}),
  };
}

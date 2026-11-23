import type {
  CatalogMedia,
  CatalogSection,
} from "@event-management/contracts/catalog";
import { uploadCatalogMedia } from "../../data/catalog/media";

type CatalogContent = {
  name: string;
  sections: CatalogSection[];
};

export async function uploadPendingCatalogMedia<T extends CatalogContent>(
  content: T,
  files: Record<string, File>,
  onUploaded: (widgetId: string, uploaded: CatalogMedia) => void,
): Promise<T> {
  const next = structuredClone(content);

  for (const section of next.sections)
    for (const widget of section.widgets)
      if (files[widget.id]) {
        const uploaded = await uploadCatalogMedia(files[widget.id]);
        widget.media = uploaded;
        onUploaded(widget.id, uploaded);
      }

  next.name = next.name.trim();

  return next;
}

export function unreferencedUploadIds(
  sections: CatalogSection[],
  uploadedIds: string[],
) {
  const usedIds = new Set(
    sections
      .flatMap((section) => section.widgets)
      .map((widget) => widget.media?.id)
      .filter(Boolean),
  );

  return uploadedIds.filter((id) => !usedIds.has(id));
}

import { useRef } from "react";
import { createPortal } from "react-dom";
import { Button, Dialog, FormField, Input } from "@event-management/ui";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { getAdminServices } from "../../lib/data/catalog/services";
import { getAdminPackages } from "../../lib/data/catalog/packages";
import type {
  CatalogServicePreview,
  ServicePricing,
} from "@event-management/contracts/catalog";
import { CatalogPicker } from "./CatalogPicker";

// API pages include pricing and nested canvases; widgets only carry this preview.
const preview = ({
  id,
  slug,
  name,
  description,
  imageUrl,
}: CatalogServicePreview): CatalogServicePreview => ({
  id,
  slug,
  name,
  description,
  imageUrl,
});

async function loadPackages(search: string, cursor?: string) {
  const page = await getAdminPackages({ archived: "active", search, cursor });

  return { items: page.packages.map(preview), nextCursor: page.nextCursor };
}

async function loadServices(search: string, cursor?: string) {
  const page = await getAdminServices({ archived: "active", search, cursor });

  return {
    items: page.services.map((service) => ({
      ...preview(service),
      pricing: {
        fixedPricePesos: service.fixedPricePesos,
        includedHours: service.includedHours,
        hourlyRatePesos: service.hourlyRatePesos,
      },
    })),
    nextCursor: page.nextCursor,
  };
}

export function CatalogReferencePickerDialog({
  kind,
  selectedId,
  caption,
  onCaptionChange,
  onSelect,
  onClose,
  hideCaption = false,
}: {
  hideCaption?: boolean;
  kind: "service" | "package";
  selectedId?: string | null;
  caption: string;
  onCaptionChange: (caption: string) => void;
  onSelect: (
    item: CatalogServicePreview & { pricing?: ServicePricing },
  ) => void;
  onClose: () => void;
}) {
  const plural = kind === "package" ? "packages" : "services";

  const searchRef = useRef<HTMLInputElement>(null);

  return createPortal(
    <Dialog
      title={`Choose a ${kind}`}
      intro={`Choose a ${kind} below to add its photo and details to this widget.`}
      onClose={onClose}
      initialFocus={searchRef}
      className="pe-reference-picker"
      actions={
        <Button onClick={onClose} variant="secondary">
          Done
        </Button>
      }
    >
      <CatalogPicker<CatalogServicePreview & { pricing?: ServicePricing }>
        plural={plural}
        loadPage={kind === "package" ? loadPackages : loadServices}
        searchRef={searchRef}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {!hideCaption && (
        <FormField label="Caption (optional)">
          {(props) => (
            <Input
              {...props}
              value={caption}
              maxLength={MAX_CATALOG_TEXT_LENGTH}
              onChange={(event) => onCaptionChange(event.target.value)}
            />
          )}
        </FormField>
      )}
      <p className="pe-reference-picker-note">Changes apply when you save.</p>
    </Dialog>,
    document.body,
  );
}

import { useState } from "react";
import { Button, useNotifications } from "@event-management/ui";
import type { PackageContent } from "@event-management/contracts/catalog";
import { CatalogCreateDialog } from "./CatalogCreateDialog";
import { PackageDetailsFields } from "./PackageDetailsFields";
import { validatePackageDetails } from "../../lib/utils/catalog/details-validation";
import { CatalogEditor, newCatalogSection } from "./CatalogEditor";
import { CatalogCard } from "./CatalogCard";
import {
  createPackage,
  updatePackage,
  packageImageSrc,
  type AdminPackage,
} from "../../lib/data/catalog/packages";
import { priceLabel } from "../../lib/utils/formatting/money";
import { PackageCanvas } from "./CatalogContent";
import { useThumbnail } from "../../lib/utils/catalog/use-thumbnail";
import "../../styles/catalog/package-editor.css";

const blank = (): PackageContent => ({
  name: "",
  description: "",
  maxGuests: 100,
  price: { kind: "fixed", currency: "PHP", amountMinor: 0 },
  sections: [newCatalogSection()],
});

export function PackageCard({
  item,
  action,
}: {
  item: PackageContent & { imageUrl?: string | null };
  action?: React.ReactNode;
}) {
  return (
    <CatalogCard
      image={packageImageSrc(item.imageUrl ?? null) || undefined}
      eyebrow="Event package"
      title={item.name || "Untitled package"}
      description={item.description}
      metadata={[
        {
          label: "Package price",
          value: priceLabel(item.price).replace(/ total$/, ""),
        },
        { label: "Maximum guests", value: `Up to ${item.maxGuests} guests` },
      ]}
      action={action}
    />
  );
}

export function PackageEditor({
  initial,
  onClose,
  onSaved,
  saveCustom,
}: {
  initial: AdminPackage | null;
  onClose: () => void;
  onSaved: () => void;
  saveCustom?: (content: PackageContent) => Promise<void>;
}) {
  const { notify, notifyError } = useNotifications();
  const [draft, setDraft] = useState(blank);
  const [prepared, setPrepared] = useState(false);

  // Seed the preview URL from the existing imageUrl when editing.
  const thumbnail = useThumbnail(
    initial ? (packageImageSrc(initial.imageUrl ?? null) ?? null) : null,
  );

  if (!initial && !prepared) {
    return (
      <CatalogCreateDialog
        entity="package"
        privateProposal={!!saveCustom}
        initial={draft}
        uploading={thumbnail.uploading}
        onClose={() => {
          thumbnail.cancelAndCleanup();
          onClose();
        }}
        onContinue={(content) => {
          setDraft(content);
          setPrepared(true);
        }}
        validate={validatePackageDetails}
        renderDetails={(content, setContent) => (
          <PackageDetailsFields
            content={content}
            onChange={setContent}
            privateProposal={!!saveCustom}
            thumbnailPreviewUrl={thumbnail.previewUrl}
            onThumbnailChange={thumbnail.handleChange}
            onThumbnailError={(msg) => notifyError(msg)}
            onThumbnailBusyChange={thumbnail.setUploading}
          />
        )}
      />
    );
  }

  return (
    <CatalogEditor<PackageContent>
      initial={
        initial
          ? {
              name: initial.name,
              description: initial.description,
              maxGuests: initial.maxGuests,
              price: initial.price,
              sections: initial.sections,
            }
          : draft
      }
      entity="package"
      privateProposal={!!saveCustom}
      saveLabel={saveCustom ? "Save private package" : undefined}
      onClose={onClose}
      onSaved={onSaved}
      validate={validatePackageDetails}
      onSave={async (content) => {
        if (saveCustom) await saveCustom(content);
        else if (initial)
          await updatePackage(
            initial.id,
            content,
            initial.updatedAt,
            thumbnail.mediaIdRef.current,
          );
        else await createPackage(content, thumbnail.mediaIdRef.current);
      }}
      renderDetails={(content, setContent) => (
        <PackageDetailsFields
          content={content}
          onChange={setContent}
          privateProposal={!!saveCustom}
          thumbnailPreviewUrl={thumbnail.previewUrl}
          onThumbnailChange={thumbnail.handleChange}
          onThumbnailError={(msg) => notifyError(msg)}
          onThumbnailBusyChange={thumbnail.setUploading}
        />
      )}
      renderPreview={(content, mode) =>
        mode === "customer" ? (
          <PackageCanvas
            bookingAction={
              !saveCustom ? (
                <Button
                  onClick={() =>
                    notify(
                      "Booking is available after saving and opening the package.",
                      "info",
                    )
                  }
                >
                  Book now
                </Button>
              ) : undefined
            }
            item={content}
          />
        ) : (
          <div className="pe-card-preview">
            <PackageCard
              item={{ ...content, imageUrl: thumbnail.previewUrl }}
            />
          </div>
        )
      }
    />
  );
}

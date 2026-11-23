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
import { useThumbnail } from "../../lib/services/catalog/use-thumbnail";
import { ApiError } from "../../lib/http/request";
import "../../styles/catalog/package-editor.css";

const blank = (): PackageContent => ({
  name: "",
  description: "",
  maxGuests: 100,
  price: { kind: "fixed", currency: "PHP", amountMinor: 0 },
  sections: [newCatalogSection()],
  eventType: null,
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
      eventTypeBadge={item.eventType ?? null}
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
  saveCustom?: (
    content: PackageContent,
    thumbnailMediaId?: string | null,
  ) => Promise<void>;
}) {
  const { notify } = useNotifications();
  const [draft, setDraft] = useState(blank);
  const [prepared, setPrepared] = useState(false);

  // Seed the preview URL from the existing imageUrl when editing.
  const thumbnail = useThumbnail(
    initial ? (packageImageSrc(initial.imageUrl ?? null) ?? null) : null,
  );

  const cancel = () => {
    thumbnail.cancelAndCleanup();
    onClose();
  };

  if (!initial && !prepared) {
    return (
      <CatalogCreateDialog
        entity="package"
        privateProposal={!!saveCustom}
        initial={draft}
        uploading={thumbnail.uploading}
        onClose={cancel}
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
            thumbnail={thumbnail}
          />
        )}
      />
    );
  }

  return (
    <CatalogEditor<PackageContent>
      nameBadge={(c) => (c.eventType ? <span>{c.eventType}</span> : null)}
      initial={
        initial
          ? {
              name: initial.name,
              description: initial.description,
              maxGuests: initial.maxGuests,
              price: initial.price,
              sections: initial.sections,
              eventType: initial.eventType ?? null,
            }
          : draft
      }
      entity="package"
      privateProposal={!!saveCustom}
      saveLabel={saveCustom ? "Save private package" : undefined}
      onClose={cancel}
      onSaved={onSaved}
      uploadingThumbnail={thumbnail.uploading}
      validate={validatePackageDetails}
      onSave={async (content) => {
        const thumbnailId = thumbnail.mediaIdRef.current;

        if (saveCustom) {
          try {
            await saveCustom(content, thumbnailId);
          } catch (error) {
            if (error instanceof ApiError && error.status === 409)
              thumbnail.cancelAndCleanup();

            throw error;
          }
        } else if (initial)
          await updatePackage(
            initial.id,
            content,
            initial.updatedAt,
            thumbnailId,
          );
        else await createPackage(content, thumbnailId);
      }}
      renderDetails={(content, setContent) => (
        <PackageDetailsFields
          content={content}
          onChange={setContent}
          privateProposal={!!saveCustom}
          thumbnail={thumbnail}
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

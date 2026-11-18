import { useEffect, useRef, useState } from "react";
import { Button, Select, useNotifications } from "@event-management/ui";
import {
  MAX_PACKAGE_SERVICES,
  type PackageContent,
} from "@event-management/contracts/catalog";
import {
  getAdminServices,
  type AdminService,
} from "../../lib/data/catalog/services";
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
import { deleteCatalogMedia } from "../../lib/data/catalog/media";
import { priceLabel } from "../../lib/utils/formatting/money";
import { PackageCanvas } from "./CatalogContent";
import { photos } from "../../demo/catalog/photos";
import "../../styles/catalog/package-editor.css";

const blank = (): PackageContent => ({
  name: "",
  description: "",
  maxGuests: 100,
  price: { kind: "fixed", currency: "PHP", amountMinor: 0 },
  sections: [newCatalogSection()],
  services: [],
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
      image={packageImageSrc(item.imageUrl ?? null) || photos.dinner}
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
  const [serviceOptions, setServiceOptions] = useState<AdminService[]>([]);
  const [serviceCursor, setServiceCursor] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const alive = useRef(true);
  async function loadServices(cursor?: string) {
    setServiceLoading(true);
    try {
      const page = await getAdminServices({ cursor, archived: "active" });
      if (!alive.current) return;
      setServiceOptions((previous) =>
        cursor ? [...previous, ...page.services] : page.services,
      );
      setServiceCursor(page.nextCursor);
      setServiceError("");
    } catch (cause) {
      if (alive.current)
        setServiceError(notifyError(cause, "Unable to load services."));
    } finally {
      if (alive.current) setServiceLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    if (saveCustom) void loadServices();
    return () => {
      alive.current = false;
    };
  }, [saveCustom]);

  const [draft, setDraft] = useState(blank);
  const [prepared, setPrepared] = useState(false);

  // Thumbnail state — lives here so it survives the create→editor transition.
  // `null` means "explicitly cleared". `undefined` means "user has not touched it
  // this session" — in that case we omit it from the save so the DB value is preserved.
  const [thumbnailMediaId, setThumbnailMediaId] = useState<string | null | undefined>(undefined);
  // Seed previewUrl from initial.imageUrl so an existing thumbnail shows in the field.
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    initial ? (packageImageSrc(initial.imageUrl ?? null) ?? null) : null,
  );
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  // Ref mirrors the state so onSave closures always read the latest value.
  const thumbnailMediaIdRef = useRef<string | null | undefined>(undefined);

  const handleThumbnailChange = (
    mediaId: string | null,
    previewUrl: string | null,
  ) => {
    thumbnailMediaIdRef.current = mediaId;
    setThumbnailMediaId(mediaId);
    setThumbnailPreviewUrl(previewUrl);
  };

  if (!initial && !prepared) {
    return (
      <CatalogCreateDialog
        entity="package"
        privateProposal={!!saveCustom}
        initial={draft}
        uploading={thumbnailUploading}
        onClose={() => {
          // Clean up any uploaded-but-unsaved thumbnail asset (AC-07).
          if (thumbnailMediaIdRef.current) void deleteCatalogMedia(thumbnailMediaIdRef.current);
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
            thumbnailMediaId={thumbnailMediaId ?? null}
            thumbnailPreviewUrl={thumbnailPreviewUrl}
            onThumbnailChange={handleThumbnailChange}
            onThumbnailError={(msg) => notifyError(msg)}
            onThumbnailBusyChange={setThumbnailUploading}
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
              services: initial.services.map(({ serviceId, role }) => ({
                serviceId,
                role,
              })),
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
          await updatePackage(initial.id, content, initial.updatedAt, thumbnailMediaIdRef.current);
        else await createPackage(content, thumbnailMediaIdRef.current);
      }}
      renderDetails={(content, setContent) => (
        <>
          {saveCustom && (
            <fieldset>
              <legend>Package services</legend>
              {content.services.map((link, index) => (
                <div key={link.serviceId}>
                  <span>
                    {serviceOptions.find((s) => s.id === link.serviceId)
                      ?.name ??
                      initial?.services.find(
                        (s) => s.serviceId === link.serviceId,
                      )?.name ??
                      link.serviceId}
                  </span>{" "}
                  <Select
                    aria-label="Service inclusion"
                    value={link.role}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        services: content.services.map((v, i) =>
                          i === index
                            ? {
                                ...v,
                                role:
                                  e.target.value === "optional"
                                    ? "optional"
                                    : "included",
                              }
                            : v,
                        ),
                      })
                    }
                  >
                    <option value="included">Included</option>
                    <option value="optional">Optional</option>
                  </Select>{" "}
                  <Button
                    variant="secondary"
                    aria-label={`Move ${serviceOptions.find((s) => s.id === link.serviceId)?.name ?? "service"} up`}
                    disabled={index === 0}
                    onClick={() => {
                      const services = [...content.services];
                      [services[index - 1], services[index]] = [
                        services[index],
                        services[index - 1],
                      ];
                      setContent({ ...content, services });
                    }}
                  >
                    ↑
                  </Button>{" "}
                  <Button
                    variant="secondary"
                    aria-label={`Move ${serviceOptions.find((s) => s.id === link.serviceId)?.name ?? "service"} down`}
                    disabled={index === content.services.length - 1}
                    onClick={() => {
                      const services = [...content.services];
                      [services[index + 1], services[index]] = [
                        services[index],
                        services[index + 1],
                      ];
                      setContent({ ...content, services });
                    }}
                  >
                    ↓
                  </Button>{" "}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setContent({
                        ...content,
                        services: content.services.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Select
                aria-label="Add service"
                disabled={content.services.length >= MAX_PACKAGE_SERVICES}
                value=""
                onChange={(e) => {
                  if (e.target.value)
                    setContent({
                      ...content,
                      services: [
                        ...content.services,
                        { serviceId: e.target.value, role: "included" },
                      ],
                    });
                }}
              >
                <option value="">Add a service…</option>
                {serviceOptions
                  .filter(
                    (s) =>
                      !s.archivedAt &&
                      !content.services.some((v) => v.serviceId === s.id),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
              {serviceError && (
                <p role="alert">
                  {serviceError}{" "}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void loadServices(
                        serviceOptions.length
                          ? (serviceCursor ?? undefined)
                          : undefined,
                      )
                    }
                  >
                    Retry
                  </Button>
                </p>
              )}
              {serviceCursor && !serviceError && (
                <Button
                  variant="secondary"
                  disabled={serviceLoading}
                  onClick={() => void loadServices(serviceCursor)}
                >
                  Load more services
                </Button>
              )}
            </fieldset>
          )}
          <PackageDetailsFields
            content={content}
            onChange={setContent}
            privateProposal={!!saveCustom}
            thumbnailMediaId={thumbnailMediaId ?? null}
            thumbnailPreviewUrl={thumbnailPreviewUrl}
            onThumbnailChange={handleThumbnailChange}
            onThumbnailError={(msg) => notifyError(msg)}
            onThumbnailBusyChange={setThumbnailUploading}
          />
        </>
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
            item={{
              ...content,
              services: content.services.map((s) => ({
                ...s,
                name:
                  serviceOptions.find((o) => o.id === s.serviceId)?.name ??
                  initial?.services.find((o) => o.serviceId === s.serviceId)
                    ?.name ??
                  "Service",
              })),
            }}
          />
        ) : (
          <div className="pe-card-preview">
            <PackageCard item={content} />
          </div>
        )
      }
    />
  );
}

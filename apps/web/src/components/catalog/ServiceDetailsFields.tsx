import type { ServiceContent } from "@event-management/contracts/catalog";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { FormField, Input, Textarea } from "@event-management/ui";
import { ThumbnailField } from "./ThumbnailField";

export function ServiceDetailsFields({
  content,
  onChange,
  thumbnailMediaId,
  thumbnailPreviewUrl,
  onThumbnailChange,
  onThumbnailError,
  onThumbnailBusyChange,
}: {
  content: ServiceContent;
  onChange: (content: ServiceContent) => void;
  thumbnailMediaId: string | null;
  thumbnailPreviewUrl: string | null;
  onThumbnailChange: (mediaId: string | null, previewUrl: string | null) => void;
  onThumbnailError: (message: string) => void;
  onThumbnailBusyChange: (busy: boolean) => void;
}) {
  return (
    <div className="form-grid">
      <FormField className="full" label="Catalog description *">
        {(field) => (
          <Textarea
            {...field}
            required
            maxLength={MAX_CATALOG_TEXT_LENGTH}
            value={content.description}
            onChange={(e) =>
              onChange({ ...content, description: e.target.value })
            }
          />
        )}
      </FormField>
      <FormField
        label={
          content.includedHours != null
            ? "Fixed price (PHP) *"
            : "Fixed price (PHP)"
        }
        description="Optional. Leave this and included hours blank for hourly-only pricing."
      >
        {(field) => (
          <Input
            {...field}
            required={content.includedHours != null}
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={content.fixedPricePesos ?? ""}
            onChange={(e) =>
              onChange({
                ...content,
                fixedPricePesos:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        )}
      </FormField>
      <FormField
        label={
          content.fixedPricePesos != null
            ? "Included hours *"
            : "Included hours"
        }
        description="Whole hours covered by the fixed price."
      >
        {(field) => (
          <Input
            {...field}
            required={content.fixedPricePesos != null}
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={content.includedHours ?? ""}
            onChange={(e) =>
              onChange({
                ...content,
                includedHours:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        )}
      </FormField>
      <FormField
        className="full"
        label={
          content.fixedPricePesos != null || content.includedHours != null
            ? "Excess hourly rate (PHP) *"
            : "Hourly rate (PHP) *"
        }
        description={
          content.fixedPricePesos != null || content.includedHours != null
            ? "Charged for each additional hour."
            : "Enter whole pesos. A rate is required."
        }
      >
        {(field) => (
          <Input
            {...field}
            required
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={content.hourlyRatePesos ?? ""}
            onChange={(e) =>
              onChange({
                ...content,
                hourlyRatePesos:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        )}
      </FormField>
      <ThumbnailField
        mediaId={thumbnailMediaId}
        previewUrl={thumbnailPreviewUrl}
        onChange={onThumbnailChange}
        onError={onThumbnailError}
        onBusyChange={onThumbnailBusyChange}
      />
    </div>
  );
}

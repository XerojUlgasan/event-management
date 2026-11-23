import type { PackageContent } from "@event-management/contracts/catalog";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { FormField, Input, Textarea } from "@event-management/ui";
import {
  centavosToPesos,
  pesosToCentavos,
} from "../../lib/utils/formatting/money";
import { ThumbnailField, type ThumbnailFieldProps } from "./ThumbnailField";
import { EventTypeField } from "./EventTypeField";

export function PackageDetailsFields({
  content,
  onChange,
  privateProposal = false,
  thumbnail,
}: {
  privateProposal?: boolean;
  content: PackageContent;
  onChange: (content: PackageContent) => void;
  thumbnail: ThumbnailFieldProps;
}) {
  return (
    <div className="form-grid">
      <FormField
        className="full"
        label={privateProposal ? "Package description" : "Catalog description"}
        description={
          privateProposal
            ? "Optional. A short introduction for this package."
            : "Optional. A short introduction for the catalog card."
        }
      >
        {(field) => (
          <Textarea
            {...field}
            maxLength={MAX_CATALOG_TEXT_LENGTH}
            value={content.description}
            onChange={(e) =>
              onChange({ ...content, description: e.target.value })
            }
          />
        )}
      </FormField>
      <FormField label="Maximum guests *">
        {(field) => (
          <Input
            {...field}
            required
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={content.maxGuests || ""}
            onChange={(e) =>
              onChange({ ...content, maxGuests: Number(e.target.value) })
            }
          />
        )}
      </FormField>
      <FormField
        label="Package price (PHP) *"
        description="Enter the total price in whole pesos."
      >
        {(field) => (
          <Input
            {...field}
            required
            type="number"
            min="1"
            max="21474836"
            step="1"
            value={
              content.price.amountMinor
                ? centavosToPesos(content.price.amountMinor)
                : ""
            }
            onChange={(e) =>
              onChange({
                ...content,
                price: {
                  ...content.price,
                  amountMinor: pesosToCentavos(Number(e.target.value)),
                },
              })
            }
          />
        )}
      </FormField>
      <EventTypeField
        allowNull
        value={content.eventType ?? null}
        onChange={(v) => onChange({ ...content, eventType: v })}
      />
      <ThumbnailField {...thumbnail} />
    </div>
  );
}

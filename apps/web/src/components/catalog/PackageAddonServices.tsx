import { useState } from "react";
import { Button, Icon } from "@event-management/ui";
import {
  MAX_PACKAGE_ADDON_SERVICES,
  type PackageContent,
} from "@event-management/contracts/catalog";
import { servicePricingLabels } from "../../lib/utils/formatting/money";
import { CatalogReferencePickerDialog } from "./CatalogReferencePickerDialog";
import { ServiceTermsDialog } from "./ServiceTermsDialog";

export function PackageAddonServices({
  content,
  onChange,
}: {
  content: PackageContent;
  onChange: (value: PackageContent) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const addons = content.addonServices ?? [];

  const selected = addons.find((item) => item.id === editing);

  return (
    <section>
      <h3>Add-on services</h3>
      <p>
        Optional services for this private package. Prices are saved with this
        package.
      </p>
      {addons.map((item) => {
        const labels = servicePricingLabels(item);

        return (
          <div key={item.id}>
            <strong>{item.service?.name ?? "Unavailable service"}</strong> ·{" "}
            {labels.price}
            {labels.excess && ` · ${labels.excess}`}
            <Button
              variant="plain"
              aria-label={`Settings for ${item.service?.name ?? "add-on service"}`}
              aria-haspopup="dialog"
              onClick={() => setEditing(item.id)}
            >
              <Icon name="more" size={20} />
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                onChange({
                  ...content,
                  addonServices: addons.filter((entry) => entry.id !== item.id),
                })
              }
            >
              Remove
            </Button>
          </div>
        );
      })}
      {error && <p role="alert">{error}</p>}
      <Button
        variant="secondary"
        disabled={addons.length >= MAX_PACKAGE_ADDON_SERVICES}
        onClick={() => setPicking(true)}
      >
        Add service
      </Button>
      {picking && (
        <CatalogReferencePickerDialog
          kind="service"
          caption=""
          hideCaption
          onCaptionChange={() => {}}
          onClose={() => setPicking(false)}
          onSelect={({ pricing, ...service }) => {
            if (!pricing) return;

            if (
              addons.some(
                (entry) =>
                  entry.serviceId.toLowerCase() === service.id.toLowerCase(),
              )
            ) {
              setError("This service is already an add-on.");
              setPicking(false);

              return;
            }

            if (
              content.sections.some((section) =>
                section.widgets.some(
                  (widget) =>
                    widget.type === "service" &&
                    widget.serviceId?.toLowerCase() ===
                      service.id.toLowerCase(),
                ),
              )
            ) {
              setError(
                "This service is already included in the package. Remove it from the canvas before adding it as an add-on.",
              );
              setPicking(false);

              return;
            }

            setError("");
            onChange({
              ...content,
              addonServices: [
                ...addons,
                {
                  id: crypto.randomUUID(),
                  serviceId: service.id,
                  service,
                  ...pricing,
                },
              ],
            });
            setPicking(false);
          }}
        />
      )}
      {selected && (
        <ServiceTermsDialog
          addon
          serviceId={selected.serviceId}
          terms={selected}
          onClose={() => setEditing(null)}
          onSave={(pricing) => {
            onChange({
              ...content,
              addonServices: addons.map((item) =>
                item.id === selected.id ? { ...item, ...pricing } : item,
              ),
            });
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

import { useState } from "react";
import { Button, DataTable } from "@event-management/ui";
import {
  MAX_PACKAGE_ADDON_SERVICES,
  type PackageContent,
  type PackageAddonService,
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
    <section className="pe-addons">
      <h3>Add-on services</h3>
      <p className="pe-addons-help">
        Optional services for this private package. Prices are saved with this
        package.
      </p>
      {addons.length ? (
        <DataTable<PackageAddonService>
          className="pe-addon-table"
          label="Add-on services"
          minWidth={510}
          rows={addons}
          rowKey={(item) => item.id}
          columns={[
            {
              key: "service",
              header: "Service",
              cell: (item) => item.service?.name ?? "Unavailable service",
            },
            {
              key: "pricing",
              header: "Package pricing",
              cell: (item) => {
                const labels = servicePricingLabels(item);

                return (
                  <div className="pe-addon-pricing">
                    {labels.price}
                    {labels.excess && <span>{labels.excess}</span>}
                  </div>
                );
              },
            },
            {
              key: "actions",
              header: "Actions",
              cell: (item) => {
                const name = item.service?.name ?? "add-on service";

                return (
                  <div className="pe-addon-actions">
                    <Button
                      variant="secondary"
                      size="icon"
                      icon="edit"
                      aria-label={`Settings for ${name}`}
                      title={`Settings for ${name}`}
                      aria-haspopup="dialog"
                      onClick={() => setEditing(item.id)}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      icon="trash"
                      aria-label={`Remove ${name}`}
                      title={`Remove ${name}`}
                      onClick={() =>
                        onChange({
                          ...content,
                          addonServices: addons.filter(
                            (entry) => entry.id !== item.id,
                          ),
                        })
                      }
                    />
                  </div>
                );
              },
            },
          ]}
        />
      ) : (
        <p className="pe-addon-empty">No add-on services yet.</p>
      )}
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

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, Dialog, FormField, Input } from "@event-management/ui";
import type {
  IncludedServiceTerms,
  ServicePricing,
} from "@event-management/contracts/catalog";
import {
  includedServiceTermsSchema,
  servicePricingSchema,
} from "@event-management/contracts/catalog-service-terms";
import { getAdminService } from "../../lib/data/catalog/services";
import { ServicePricingFields } from "./ServiceDetailsFields";

export function ServiceTermsDialog({
  serviceId,
  terms,
  addon,
  onSave,
  onClose,
}: {
  serviceId: string;
  terms: IncludedServiceTerms | ServicePricing;
  addon?: boolean;
  onSave: (terms: ServicePricing) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState<ServicePricing>({
    fixedPricePesos: "fixedPricePesos" in terms ? terms.fixedPricePesos : null,
    includedHours: terms.includedHours,
    hourlyRatePesos: terms.hourlyRatePesos,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = async () => {
    setBusy(true);
    setError("");

    try {
      const service = await getAdminService(serviceId);
      setValue({
        fixedPricePesos: service.fixedPricePesos,
        includedHours: service.includedHours,
        hourlyRatePesos: service.hourlyRatePesos,
      });
    } catch {
      setError("Could not load service defaults. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <Dialog
      title={addon ? "Add-on service settings" : "Included service settings"}
      intro={
        addon
          ? "Set the terms for this package."
          : "The service base fee is covered by the package price."
      }
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={reset} pending={busy}>
            Reset to defaults
          </Button>
          <Button
            onClick={() => {
              const result = addon
                ? servicePricingSchema.safeParse(value)
                : includedServiceTermsSchema.safeParse({
                    includedHours: value.includedHours,
                    hourlyRatePesos: value.hourlyRatePesos,
                  });

              if (!result.success) {
                setError(
                  addon
                    ? "Enter valid whole numbers. Add-ons require an hourly rate and fixed price and hours together."
                    : "Enter positive whole numbers or leave the fields blank.",
                );

                return;
              }

              onSave(value);
            }}
            disabled={busy}
          >
            Save settings
          </Button>
        </>
      }
    >
      {addon ? (
        <div className="form-grid">
          <ServicePricingFields content={value} onChange={setValue} />
        </div>
      ) : (
        <div className="form-grid">
          <FormField
            label="Included hours"
            description="Leave blank if unspecified."
          >
            {(field) => (
              <Input
                {...field}
                type="number"
                min="1"
                max="2147483647"
                step="1"
                value={value.includedHours ?? ""}
                onChange={(e) =>
                  setValue({
                    ...value,
                    includedHours:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            )}
          </FormField>
          <FormField
            label="Excess hourly rate (PHP)"
            description="Leave blank if unspecified."
          >
            {(field) => (
              <Input
                {...field}
                type="number"
                min="1"
                max="2147483647"
                step="1"
                value={value.hourlyRatePesos ?? ""}
                onChange={(e) =>
                  setValue({
                    ...value,
                    hourlyRatePesos:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            )}
          </FormField>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </Dialog>,
    document.body,
  );
}

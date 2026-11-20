import { useRef, useState } from "react";
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
import { servicePricingLabels } from "../../lib/utils/formatting/money";
import { ServicePricingFields } from "./ServiceDetailsFields";

export function ServiceTermsDialog({
  serviceId,
  terms,
  addon,
  immediate = false,
  refresh,
  editDisabled = false,
  onSave,
  onClose,
}: {
  serviceId: string;
  terms: IncludedServiceTerms | ServicePricing;
  addon?: boolean;
  immediate?: boolean;
  refresh?: () => Promise<void>;
  editDisabled?: boolean;
  onSave: (terms: ServicePricing) => void | Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState<ServicePricing>({
    fixedPricePesos: "fixedPricePesos" in terms ? terms.fixedPricePesos : null,
    includedHours: terms.includedHours,
    hourlyRatePesos: terms.hourlyRatePesos,
  });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const savingRef = useRef(false);
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

  const save = async () => {
    if (busy || savingRef.current || refresh || editDisabled) return;

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

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave(value);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update service settings.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const refreshPackage = async () => {
    if (!refresh || savingRef.current) return;

    savingRef.current = true;
    setRefreshing(true);
    setError("");

    try {
      await refresh();
      setReviewed(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to refresh the package.",
      );
    } finally {
      savingRef.current = false;
      setRefreshing(false);
    }
  };

  const labels =
    "fixedPricePesos" in terms ? servicePricingLabels(terms) : null;

  return createPortal(
    <Dialog
      title={addon ? "Add-on service settings" : "Included service settings"}
      intro={
        addon
          ? immediate
            ? "Updating these settings changes the private package immediately, even if you cancel the quotation."
            : "Set the terms for this package."
          : "The service base fee is covered by the package price."
      }
      onClose={() => {
        if (!savingRef.current) onClose();
      }}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={reset}
            pending={busy}
            disabled={saving || refreshing || editDisabled}
          >
            Reset to defaults
          </Button>
          {refresh && (
            <Button
              variant="secondary"
              pending={refreshing}
              disabled={busy}
              onClick={() => void refreshPackage()}
            >
              Refresh package
            </Button>
          )}
          <Button
            onClick={() => void save()}
            disabled={busy || !!refresh || editDisabled}
            pending={saving}
          >
            {immediate ? "Update package add-on" : "Save settings"}
          </Button>
        </>
      }
    >
      {addon ? (
        <fieldset
          className="form-grid"
          disabled={saving || refreshing || editDisabled}
        >
          <ServicePricingFields content={value} onChange={setValue} />
        </fieldset>
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
      {reviewed && labels && (
        <p role="status">
          Current package pricing is {labels.price}
          {labels.excess && ` and ${labels.excess}`}. Review it before updating.
        </p>
      )}
      {editDisabled && (
        <p role="alert">Remove this add-on from the package to continue.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </Dialog>,
    document.body,
  );
}
